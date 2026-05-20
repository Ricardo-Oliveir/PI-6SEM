const admin = require('firebase-admin');


try {
    const serviceAccount = require('../firebase-adminsdk-key.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} catch (e) {
    // Se o arquivo não existir, tenta inicializar com as credenciais padrão do ambiente
    // (Útil para emuladores locais)
    admin.initializeApp();
}
const db = admin.firestore();

async function deleteCollection(collectionPath, batchSize = 100) {
    const collectionRef = db.collection(collectionPath);
    const query = collectionRef.orderBy('__name__').limit(batchSize);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(query, resolve).catch(reject);
    });
}

async function deleteQueryBatch(query, resolve) {
    const snapshot = await query.get();

    const batchSize = snapshot.size;
    if (batchSize === 0) {
        resolve();
        return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();

    process.nextTick(() => {
        deleteQueryBatch(query, resolve);
    });
}

async function reset() {
    console.log('🚀 Iniciando limpeza do banco de questionários...');
    
    const collections = ['questionnaires', 'questions', 'responses', 'response_sessions'];
    
    for (const col of collections) {
        console.log(`🧹 Limpando coleção: ${col}...`);
        await deleteCollection(col);
        console.log(`✅ Coleção ${col} limpa!`);
    }
    
    console.log('\n✨ Banco de questionários resetado com sucesso!');
    console.log('⚠️ Os usuários foram preservados.');
}

reset().catch(err => {
    console.error('❌ Erro ao resetar banco:', err);
    process.exit(1);
});
