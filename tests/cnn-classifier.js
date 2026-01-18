#!/usr/bin/env node
// CNN-based item classifier using TensorFlow.js
// Uses a siamese network approach to compare screenshot crops against templates

const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const CROP_SIZE = 48;
const EMBEDDING_SIZE = 64;
const BATCH_SIZE = 32;
const EPOCHS = 15;

// Build the embedding network (shared weights for siamese)
function buildEmbeddingNetwork() {
    const model = tf.sequential();

    // Conv block 1
    model.add(tf.layers.conv2d({
        inputShape: [CROP_SIZE, CROP_SIZE, 3],
        filters: 32,
        kernelSize: 3,
        activation: 'relu',
        padding: 'same'
    }));
    model.add(tf.layers.batchNormalization());
    model.add(tf.layers.maxPooling2d({ poolSize: 2 }));

    // Conv block 2
    model.add(tf.layers.conv2d({
        filters: 64,
        kernelSize: 3,
        activation: 'relu',
        padding: 'same'
    }));
    model.add(tf.layers.batchNormalization());
    model.add(tf.layers.maxPooling2d({ poolSize: 2 }));

    // Conv block 3
    model.add(tf.layers.conv2d({
        filters: 128,
        kernelSize: 3,
        activation: 'relu',
        padding: 'same'
    }));
    model.add(tf.layers.batchNormalization());
    model.add(tf.layers.maxPooling2d({ poolSize: 2 }));
    model.add(tf.layers.flatten());

    // Dense embedding
    model.add(tf.layers.dense({ units: EMBEDDING_SIZE, activation: 'relu' }));
    model.add(tf.layers.dense({ units: EMBEDDING_SIZE })); // L2 normalized in use

    return model;
}

// Load image as tensor
async function loadImageAsTensor(imagePath) {
    const img = await loadImage(imagePath);
    const canvas = createCanvas(CROP_SIZE, CROP_SIZE);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, CROP_SIZE, CROP_SIZE);

    const imageData = ctx.getImageData(0, 0, CROP_SIZE, CROP_SIZE);
    const data = new Float32Array(CROP_SIZE * CROP_SIZE * 3);

    for (let i = 0; i < CROP_SIZE * CROP_SIZE; i++) {
        data[i * 3] = imageData.data[i * 4] / 255;
        data[i * 3 + 1] = imageData.data[i * 4 + 1] / 255;
        data[i * 3 + 2] = imageData.data[i * 4 + 2] / 255;
    }

    return tf.tensor3d(data, [CROP_SIZE, CROP_SIZE, 3]);
}

// Load all templates
async function loadTemplates() {
    const templatesDir = './training-data/crops/templates';
    const templates = new Map();

    if (!fs.existsSync(templatesDir)) {
        console.log('No templates directory found');
        return templates;
    }

    const itemDirs = fs.readdirSync(templatesDir);
    for (const itemId of itemDirs) {
        const itemDir = path.join(templatesDir, itemId);
        if (!fs.statSync(itemDir).isDirectory()) continue;

        const templatePath = path.join(itemDir, 'template.png');
        if (fs.existsSync(templatePath)) {
            const tensor = await loadImageAsTensor(templatePath);
            templates.set(itemId, tensor);
        }
    }

    return templates;
}

// Generate training pairs (same class = 1, different class = 0)
function generateTrainingPairs(templates, numPairs = 1000) {
    const itemIds = Array.from(templates.keys());
    const pairs = [];

    for (let i = 0; i < numPairs; i++) {
        const isSame = Math.random() > 0.5;

        if (isSame) {
            // Same class pair (using augmented versions)
            const itemId = itemIds[Math.floor(Math.random() * itemIds.length)];
            pairs.push({
                tensor1: templates.get(itemId),
                tensor2: templates.get(itemId),
                label: 1
            });
        } else {
            // Different class pair
            const idx1 = Math.floor(Math.random() * itemIds.length);
            let idx2 = Math.floor(Math.random() * itemIds.length);
            while (idx2 === idx1 && itemIds.length > 1) {
                idx2 = Math.floor(Math.random() * itemIds.length);
            }
            pairs.push({
                tensor1: templates.get(itemIds[idx1]),
                tensor2: templates.get(itemIds[idx2]),
                label: 0
            });
        }
    }

    return pairs;
}

// Data augmentation
function augmentTensor(tensor) {
    return tf.tidy(() => {
        let augmented = tensor;

        // Random brightness
        const brightness = (Math.random() - 0.5) * 0.3;
        augmented = augmented.add(brightness).clipByValue(0, 1);

        // Random contrast
        const contrast = 0.8 + Math.random() * 0.4;
        const mean = augmented.mean();
        augmented = augmented.sub(mean).mul(contrast).add(mean).clipByValue(0, 1);

        return augmented;
    });
}

// Build siamese model for training
function buildSiameseModel(embeddingNet) {
    const input1 = tf.input({ shape: [CROP_SIZE, CROP_SIZE, 3] });
    const input2 = tf.input({ shape: [CROP_SIZE, CROP_SIZE, 3] });

    const embedding1 = embeddingNet.apply(input1);
    const embedding2 = embeddingNet.apply(input2);

    // Concatenate embeddings and let dense layers learn the comparison
    const concat = tf.layers.concatenate().apply([embedding1, embedding2]);
    const dense1 = tf.layers.dense({ units: EMBEDDING_SIZE, activation: 'relu' }).apply(concat);
    const dropout = tf.layers.dropout({ rate: 0.3 }).apply(dense1);
    const output = tf.layers.dense({ units: 1, activation: 'sigmoid' }).apply(dropout);

    const model = tf.model({ inputs: [input1, input2], outputs: output });
    return model;
}

// Train the model
async function train() {
    console.log('=== CNN Classifier Training ===\n');

    // Load templates
    console.log('Loading templates...');
    const templates = await loadTemplates();
    console.log(`Loaded ${templates.size} templates\n`);

    if (templates.size < 2) {
        console.log('Need at least 2 templates to train');
        return;
    }

    // Build models
    console.log('Building model...');
    const embeddingNet = buildEmbeddingNetwork();
    const siameseModel = buildSiameseModel(embeddingNet);

    siameseModel.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
    });

    console.log('Embedding network:');
    embeddingNet.summary();

    // Generate training data
    console.log('\nGenerating training pairs...');
    const pairs = generateTrainingPairs(templates, 2000);

    // Convert to tensors with augmentation
    const input1Array = [];
    const input2Array = [];
    const labels = [];

    for (const pair of pairs) {
        input1Array.push(augmentTensor(pair.tensor1));
        input2Array.push(augmentTensor(pair.tensor2));
        labels.push(pair.label);
    }

    const x1 = tf.stack(input1Array);
    const x2 = tf.stack(input2Array);
    const y = tf.tensor2d(labels, [labels.length, 1]);

    // Clean up individual tensors
    input1Array.forEach(t => t.dispose());
    input2Array.forEach(t => t.dispose());

    console.log(`Training data shape: ${x1.shape}`);

    // Train
    console.log('\nTraining...');
    const history = await siameseModel.fit([x1, x2], y, {
        epochs: EPOCHS,
        batchSize: BATCH_SIZE,
        validationSplit: 0.2,
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                if ((epoch + 1) % 10 === 0) {
                    console.log(`Epoch ${epoch + 1}: loss=${logs.loss.toFixed(4)}, acc=${logs.acc.toFixed(4)}, val_acc=${logs.val_acc.toFixed(4)}`);
                }
            }
        }
    });

    // Save the embedding network
    const modelPath = './training-data/model';
    fs.mkdirSync(modelPath, { recursive: true });
    await embeddingNet.save(`file://${modelPath}`);
    console.log(`\nModel saved to: ${modelPath}`);

    // Cleanup
    x1.dispose();
    x2.dispose();
    y.dispose();
    templates.forEach(t => t.dispose());

    // Return final accuracy
    const finalAcc = history.history.val_acc[history.history.val_acc.length - 1];
    console.log(`\nFinal validation accuracy: ${(finalAcc * 100).toFixed(1)}%`);

    return { embeddingNet, finalAcc };
}

// Evaluate on test crops
async function evaluate() {
    console.log('\n=== Evaluation ===\n');

    // Load saved model
    const modelPath = './training-data/model/model.json';
    if (!fs.existsSync(modelPath)) {
        console.log('No trained model found. Run training first.');
        return;
    }

    const embeddingNet = await tf.loadLayersModel(`file://${modelPath}`);
    console.log('Loaded embedding model');

    // Load templates and compute embeddings
    const templates = await loadTemplates();
    const templateEmbeddings = new Map();

    for (const [itemId, tensor] of templates) {
        const embedding = embeddingNet.predict(tensor.expandDims(0));
        templateEmbeddings.set(itemId, embedding);
    }

    console.log(`Computed embeddings for ${templateEmbeddings.size} templates`);

    // Load test crops
    const cropsDir = './training-data/crops/unlabeled';
    if (!fs.existsSync(cropsDir)) {
        console.log('No test crops found');
        return;
    }

    const cropFiles = fs.readdirSync(cropsDir).filter(f => f.endsWith('.png'));
    console.log(`Testing on ${cropFiles.length} crops...\n`);

    let predictions = 0;
    const confidenceDistribution = { high: 0, medium: 0, low: 0 };

    for (const cropFile of cropFiles.slice(0, 20)) { // Test first 20
        const cropPath = path.join(cropsDir, cropFile);
        const cropTensor = await loadImageAsTensor(cropPath);
        const cropEmbedding = embeddingNet.predict(cropTensor.expandDims(0));

        // Find closest template
        let bestMatch = null;
        let bestSimilarity = -Infinity;

        for (const [itemId, templateEmb] of templateEmbeddings) {
            // Cosine similarity
            const similarity = tf.tidy(() => {
                const dot = cropEmbedding.mul(templateEmb).sum();
                const norm1 = cropEmbedding.norm();
                const norm2 = templateEmb.norm();
                return dot.div(norm1.mul(norm2)).dataSync()[0];
            });

            if (similarity > bestSimilarity) {
                bestSimilarity = similarity;
                bestMatch = itemId;
            }
        }

        const confLevel = bestSimilarity > 0.8 ? 'high' : bestSimilarity > 0.5 ? 'medium' : 'low';
        confidenceDistribution[confLevel]++;

        console.log(`${cropFile.slice(0, 40)}: ${bestMatch} (${(bestSimilarity * 100).toFixed(1)}%)`);
        predictions++;

        cropTensor.dispose();
        cropEmbedding.dispose();
    }

    console.log('\nConfidence distribution:');
    console.log(`  High (>80%): ${confidenceDistribution.high}`);
    console.log(`  Medium (50-80%): ${confidenceDistribution.medium}`);
    console.log(`  Low (<50%): ${confidenceDistribution.low}`);

    // Cleanup
    templates.forEach(t => t.dispose());
    templateEmbeddings.forEach(t => t.dispose());
}

// Main
async function main() {
    const args = process.argv.slice(2);

    if (args.includes('--evaluate') || args.includes('-e')) {
        await evaluate();
    } else {
        await train();
        await evaluate();
    }
}

main().catch(console.error);
