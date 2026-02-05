import { env, AutoModel, AutoTokenizer, BertTokenizer, BertModel, Tensor } from "@huggingface/transformers";
import { siteConfig } from "@/lib/siteConfig";

const normalizePath = (value: string) => {
    if (!value) return "";
    const trimmed = value.trim();
    if (!trimmed || trimmed === "/") return "";
    const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return withLeading.endsWith("/") ? withLeading.slice(0, -1) : withLeading;
};

const basePath = normalizePath(siteConfig.basePath || "");
const resolvePublicPath = (path: string) => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${self.location.origin}${basePath}${normalizedPath}`;
};

env.allowLocalModels = true;
env.localModelPath = resolvePublicPath("/models");
env.allowRemoteModels = false;
env.backends.onnx.device = 'wasm';
if (env.backends.onnx.wasm) {
    env.backends.onnx.wasm.wasmPaths = resolvePublicPath("/ort/");
}

const EMBEDDING_DIMENSION = 256;
const RESULT_TOPK = 20;
const MIN_SCORE = 0.25;
const STD_FACTOR = 1.5;

let model: BertModel | null = null;
let tokenizer: BertTokenizer | null = null;
let loaded = false;

async function loadModel() {
    const [tokenizerInstance, modelInstance] = await Promise.all([
        AutoTokenizer.from_pretrained('embeddings'),
        AutoModel.from_pretrained('embeddings',{
            dtype: 'q8',
        }),
    ]);
    tokenizer = tokenizerInstance;
    model = modelInstance;
    loaded = true;

    postMessage({ type: 'modelLoaded' });
}

const loadingPromise: Promise<void> = loadModel();


interface EmbeddingsEntryRaw {
    identifier: string;
    embedding: string;
}

interface EmbeddingsEntry {
    identifier: string;
    embedding: Int8Array;
}

const embeddingsCache = new Map<string, EmbeddingsEntry[]>();

function base64ToInt8Array(base64: string): Int8Array {
    const binaryString = Buffer.from(base64, 'base64');
    return new Int8Array(binaryString);
}

async function getEmbedding(text: string): Promise<Int8Array> {
    if (!loaded) {
        await loadingPromise;
    }
    if (!tokenizer || !model) {
        throw new Error('Model or tokenizer not loaded');
    }

    const inputs = await tokenizer([text], { padding: true });
    const output = await model(inputs, { outputEmbeddings: true });

    const embedding = output.sentence_embedding as Tensor;

    // truncate it to 512 dimensions
    const truncatedData: Float32Array = embedding.data.slice(0, EMBEDDING_DIMENSION) as Float32Array;


    // renormalize truncated data
    let norm = 0;
    for (let i = 0; i < truncatedData.length; i++) {
        norm += truncatedData[i] * truncatedData[i];
    }
    norm = Math.sqrt(norm);
    for (let i = 0; i < truncatedData.length; i++) {
        truncatedData[i] = truncatedData[i] / norm;
    }


    // now we need to quantize it,
    /*
     ranges = torch.tensor([[-0.3], [+0.3]]).expand(2, embeddings.shape[1]).cpu().numpy()
            quantized = quantize_embeddings(embeddings, "int8", ranges=ranges)
    */
    /*
    starts = ranges[0, :]
        steps = (ranges[1, :] - ranges[0, :]) / 255

        if precision == "uint8":
            return ((embeddings - starts) / steps).astype(np.uint8)
        elif precision == "int8":
            return ((embeddings - starts) / steps - 128).astype(np.int8)
    */

   
    const quantizedData = new Int8Array(EMBEDDING_DIMENSION);
    const start = -0.3;
    const end = 0.3;
    const step = (end - start) / 255;
    for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
        const value = truncatedData[i];
        const quantizedValue = Math.round((value - start) / step - 128);
        quantizedData[i] = quantizedValue;
    }
    return quantizedData;
}

export function cosineSimilarity(vecA: Int8Array, vecB: Int8Array, length: number): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) {
        return 0;
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function selectSemanticScores(scored: Array<{ identifier: string; score: number }>) {
    if (!scored.length) return [] as Array<{ identifier: string; score: number }>;
    const scores = scored.map((item) => item.score);
    const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
    const std = Math.sqrt(variance);
    const sortedScores = [...scores].sort((a, b) => a - b);
    const p90Index = Math.max(0, Math.floor(0.9 * (sortedScores.length - 1)));
    const p90 = sortedScores[p90Index];
    const threshold = Math.max(p90, mean + STD_FACTOR * std, MIN_SCORE);

    const ranked = scored.slice().sort((a, b) => b.score - a.score);
    let selected = ranked.filter((item) => item.score >= threshold);
    if (!selected.length) {
        selected = ranked.slice(0, RESULT_TOPK);
    } else if (selected.length > RESULT_TOPK) {
        selected = selected.slice(0, RESULT_TOPK);
    }
    return selected;
}

const onMessage = async (event: MessageEvent) => {
    const { data } = event;
    if (data.type === 'setEmbeddings') {
        const { requestId, key, entries } = data;
        const parsedEntries: EmbeddingsEntry[] = entries.map((entry: EmbeddingsEntryRaw) => ({
            identifier: entry.identifier,
            embedding: base64ToInt8Array(entry.embedding),
        }));
        embeddingsCache.set(key, parsedEntries);
        postMessage({ type: 'setEmbeddingsComplete', requestId });
    } else if (data.type === 'getScores') {
        const { requestId, key, query } = data;
        try {
            const entries = embeddingsCache.get(key);
            if (!entries) {
                throw new Error(`No embeddings found for key: ${key}`);
            }
            
            const output = await getEmbedding("Represent this sentence for searching relevant passages: " + query);
            const candidates = entries
                .map((entry) => ({
                    identifier: entry.identifier,
                    embedding: entry.embedding,
                    score: cosineSimilarity(output, entry.embedding, EMBEDDING_DIMENSION),
                }))

            const scores = selectSemanticScores(candidates);
            
            postMessage({ type: 'getScoresComplete', requestId, scores });
        } catch (error) {
            postMessage({ type: 'getScoresError', requestId, error: (error as Error).message });
        }
    }
}



addEventListener('message', onMessage);
