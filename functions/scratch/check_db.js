const admin = require('firebase-admin');
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

async function check() {
    console.log('--- VERIFICANDO USUÁRIOS ---');
    const users = await db.collection('users').get();
    const userIds = [];
    users.forEach(d => {
        console.log(`ID: ${d.id} | Nome: ${d.data().full_name} | Username: ${d.data().username}`);
        userIds.push(d.id);
    });

    console.log('\n--- VERIFICANDO SESSÕES (LIMIT 10) ---');
    const sessions = await db.collection('response_sessions').limit(10).get();
    sessions.forEach(d => {
        const data = d.data();
        console.log(`Sessão: ${d.id} | user_id: ${data.user_id} | Name na Sessão: ${data.respondent_name}`);
        if (data.user_id && !userIds.includes(String(data.user_id))) {
            console.log(`  ⚠️ ATENÇÃO: user_id ${data.user_id} NÃO existe na coleção users!`);
        }
    });
}

check().catch(console.error);
