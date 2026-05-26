// API Backend - Vida Mais (Firebase Firestore) [DEPLOY FORCE 2.0]

const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { FieldValue } = require('firebase-admin/firestore');

const app = express();
const PORT = process.env.PORT || 3000;

// Helper para normalizar usernames (minúsculas e sem espaços)
const normalizeUsername = (u) => String(u || '').toLowerCase().replace(/\s+/g, '').trim();

// Inicializar Firebase Admin SDK
let db;
try {
  // Verificar se já foi inicializado
  if (!admin.apps.length) {
    // Para desenvolvimento local, você pode usar o arquivo de chave do serviço
    // Para produção, use variáveis de ambiente
    if (process.env.FIREBASE_PRIVATE_KEY) {
      // Produção - usar variáveis de ambiente
      admin.initializeApp({
        credential: admin.credential.cert({
          type: "service_account",
          project_id: process.env.FIREBASE_PROJECT_ID,
          private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
          private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          client_email: process.env.FIREBASE_CLIENT_EMAIL,
          client_id: process.env.FIREBASE_CLIENT_ID,
          auth_uri: "https://accounts.google.com/o/oauth2/auth",
          token_uri: "https://oauth2.googleapis.com/token",
          auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
          client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`
        }),
        projectId: process.env.FIREBASE_PROJECT_ID
      });
    } else {
      // Desenvolvimento local ou execução no Google Cloud Functions
      try {
        const serviceAccount = require('./firebase-adminsdk-key.json');
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id
        });
      } catch (e) {
        // Se o arquivo não existir (porque estamos no Cloud Functions), usa o default nativo
        admin.initializeApp();
      }
    }
  }

  db = admin.firestore();
  console.log('✅ Conectado ao Firebase Firestore');
} catch (err) {
  console.error('❌ Erro ao conectar com o Firebase:', err);
  console.error('💡 Certifique-se de ter o arquivo firebase-adminsdk-key.json ou as variáveis de ambiente configuradas');
  process.exit(1);
}

// Middleware - CORS restrito às origens autorizadas
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sem origin apenas em desenvolvimento local
    if (!origin) {
      if (process.env.NODE_ENV === 'production') {
        return callback(new Error('Origem não permitida'), false);
      }
      return callback(null, true);
    }

    const allowedOrigins = [
      'https://projeto-vivamais-2026.web.app',
      'https://projeto-vivamais-2026.firebaseapp.com',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8081',
      'http://localhost:19006',
      'exp://localhost:19000',
    ];

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS bloqueado para origin: ${origin}`);
      callback(new Error('Origem não permitida pelo CORS'), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'authorization'],
  credentials: true
};
app.use(helmet());
app.use(cors(corsOptions));

// Configuração de limites de tamanho de requisição
// Aumentamos para 50MB apenas nas rotas que recebem fotos (Base64)
app.use(['/api/auth/register', '/api/users/:id', '/api/users'], express.json({ limit: '50mb' }));
// Limite padrão de 2MB para todas as outras rotas (segurança)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Middleware de logging seguro (sem expor headers/tokens)
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Middleware para verificar JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acesso requerido' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('❌ JWT_SECRET não configurado nas variáveis de ambiente');
    return res.status(500).json({ error: 'Erro de configuração do servidor' });
  }

  jwt.verify(token, secret, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido ou expirado' });
    }
    req.user = user;
    next();
  });
};

// Middleware para verificar se o usuário é admin
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores' });
  }
  next();
};

// Helper: Calcular distância euclidiana entre dois descritores faciais
const getFaceDistance = (desc1, desc2) => {
  if (!desc1 || !desc2) return 1.0;

  // Converter objetos/arrays para arrays de números se necessário
  const v1 = Array.isArray(desc1) ? desc1 : Object.values(desc1);
  const v2 = Array.isArray(desc2) ? desc2 : Object.values(desc2);

  if (v1.length !== v2.length) return 1.0;

  let sum = 0;
  for (let i = 0; i < v1.length; i++) {
    sum += Math.pow(Number(v1[i]) - Number(v2[i]), 2);
  }
  return Math.sqrt(sum);
};

// Helper: Aplicar lógica de lotes (K-Anonymity)
// Retorna apenas as sessões que fazem parte de um lote completo (múltiplo de 5)
// Se totalUsers for fornecido, aplica a regra do "último lote dinâmico" para não prender o final
const getReleasedSessions = (allSessions, batchSize = 5, totalUsersMap = {}) => {
  if (!allSessions || allSessions.length === 0) return { releasedSessions: [], pendingSessionIds: new Set() };

  const sessionsByQuest = {};
  allSessions.forEach(s => {
    const qId = s.questionnaire_id;
    if (!sessionsByQuest[qId]) sessionsByQuest[qId] = [];
    sessionsByQuest[qId].push(s);
  });

  let releasedSessions = [];
  let pendingSessionIds = new Set();

  Object.keys(sessionsByQuest).forEach(qId => {
    const sessions = sessionsByQuest[qId];
    const totalPossible = totalUsersMap[qId] || 0;
    const respondedCount = sessions.length;

    // Ordenar por data
    sessions.sort((a, b) => {
      const dateA = a.created_at?.toDate?.() || new Date(a.created_at || 0);
      const dateB = b.created_at?.toDate?.() || new Date(b.created_at || 0);
      return dateA - dateB;
    });

    let releasedCount = 0;

    if (totalPossible >= batchSize && respondedCount < totalPossible) {
      // Regra do "Último Lote Dinâmico": 
      // Se houver sobra (ex: 21 usuários), os últimos (5 + sobra) são liberados juntos no final.
      const remainder = totalPossible % batchSize;
      const threshold = totalPossible - remainder - batchSize; // Ex: 21 - 1 - 5 = 15

      if (respondedCount <= threshold) {
        releasedCount = Math.floor(respondedCount / batchSize) * batchSize;
      } else {
        // Segura no limite do penúltimo lote até que TODOS do último respondam
        releasedCount = threshold;
      }
    } else if (totalPossible > 0 && respondedCount >= totalPossible) {
      // Se todos responderam (e são pelo menos 5), libera tudo
      releasedCount = respondedCount >= batchSize ? respondedCount : 0;
    } else {
      // Lógica padrão se não soubermos o total ou se for < 5
      releasedCount = Math.floor(respondedCount / batchSize) * batchSize;
    }

    releasedSessions = releasedSessions.concat(sessions.slice(0, releasedCount));
    sessions.slice(releasedCount).forEach(s => pendingSessionIds.add(s.id));
  });

  return { releasedSessions, pendingSessionIds };
};

// Helper: Calcular média de score das respostas
const calculateAverageScore = async (sessions) => {
  if (!sessions || sessions.length === 0) return "0.0";

  try {
    const sessionIds = sessions.map(s => s.id);
    let totalScore = 0;
    let totalResponses = 0;

    // Processar em lotes de 30 para o Firestore
    for (let i = 0; i < sessionIds.length; i += 30) {
      const batch = sessionIds.slice(i, i + 30);
      const snap = await db.collection('responses')
        .where('session_id', 'in', batch)
        .get();

      snap.forEach(doc => {
        const data = doc.data();
        if (data.numeric_value !== undefined && data.numeric_value !== null) {
          totalScore += Number(data.numeric_value);
          totalResponses++;
        }
      });
    }

    return totalResponses > 0 ? (totalScore / totalResponses).toFixed(1) : "0.0";
  } catch (error) {
    console.error("Erro ao calcular score médio:", error);
    return "0.0";
  }
};

// ROTAS

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    database: 'Firebase Firestore connected'
  });
});

// Initialize Database - protegido por admin
app.post('/api/init-database', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('🔧 Inicializando estruturas do banco de dados...');

    // Verificar se já existe dados
    const collections = ['users', 'questionnaires', 'questions', 'responses'];
    const status = {};

    for (const collectionName of collections) {
      try {
        const snapshot = await db.collection(collectionName).limit(1).get();
        status[collectionName] = {
          exists: !snapshot.empty,
          count: snapshot.size
        };
      } catch (error) {
        status[collectionName] = {
          exists: false,
          error: error.message
        };
      }
    }

    // Criar usuário admin se não existir
    const adminSnapshot = await db.collection('users')
      .where('username', '==', 'admin')
      .limit(1)
      .get();

    if (adminSnapshot.empty) {
      console.log('👑 Criando usuário admin...');
      const adminPassword = 'admin123';
      const password_hash = await bcrypt.hash(adminPassword, 12);

      await db.collection('users').add({
        username: 'admin',
        full_name: 'Administrador',
        email: 'admin@vidamais.com',
        password_hash,
        role: 'admin',
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
        is_active: true
      });

      status.adminUser = 'created';
      console.log('✅ Usuário admin criado!');
    } else {
      status.adminUser = 'exists';
      console.log('✅ Usuário admin já existe');
    }

    // Criar questionários de exemplo se não existirem
    const questionnaireSnapshot = await db.collection('questionnaires').limit(1).get();

    if (questionnaireSnapshot.empty) {
      console.log('📝 Criando questionários de exemplo...');

      // Questionário 1
      const questionnaire1Ref = await db.collection('questionnaires').add({
        title: 'Pesquisa de Satisfação - Serviços para Idosos',
        description: 'Avalie a qualidade dos serviços oferecidos para a terceira idade em nossa comunidade',
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
        is_active: true
      });

      // Perguntas para o questionário 1
      const questions1 = [
        {
          text: 'Como você avalia o atendimento que recebeu?',
          type: 'rating_10',
          options: null,
          order: 1,
          is_required: true
        },
        {
          text: 'Você recomendaria nossos serviços para outros idosos?',
          type: 'yes_no',
          options: null,
          order: 2,
          is_required: true
        },
        {
          text: 'Qual aspecto do atendimento você considera mais importante?',
          type: 'multiple_choice',
          options: ['Rapidez no atendimento', 'Gentileza dos funcionários', 'Clareza nas informações', 'Ambiente acolhedor', 'Facilidade de acesso'],
          order: 3,
          is_required: true
        }
      ];

      for (const question of questions1) {
        await db.collection('questions').add({
          ...question,
          questionnaire_id: questionnaire1Ref.id,
          created_at: FieldValue.serverTimestamp()
        });
      }

      // Questionário 2
      const questionnaire2Ref = await db.collection('questionnaires').add({
        title: 'Avaliação de Acessibilidade',
        description: 'Como podemos melhorar a acessibilidade dos nossos serviços?',
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
        is_active: true
      });

      // Perguntas para o questionário 2
      const questions2 = [
        {
          text: 'Como você avalia a facilidade de acesso ao nosso local?',
          type: 'rating_10',
          options: null,
          order: 1,
          is_required: true
        },
        {
          text: 'Que melhorias de acessibilidade você sugere?',
          type: 'text',
          options: null,
          order: 2,
          is_required: false
        }
      ];

      for (const question of questions2) {
        await db.collection('questions').add({
          ...question,
          questionnaire_id: questionnaire2Ref.id,
          created_at: FieldValue.serverTimestamp()
        });
      }

      status.questionnaires = 'created';
      console.log('✅ Questionários de exemplo criados!');
    } else {
      status.questionnaires = 'exists';
      console.log('✅ Questionários já existem');
    }

    res.json({
      success: true,
      message: 'Banco de dados inicializado com sucesso',
      collections: status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro ao inicializar banco:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug endpoint - Listar todas as questões (apenas admin)
app.get('/api/debug/questions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('🔍 DEBUG: Listando TODAS as questões no banco');

    const snapshot = await db.collection('questions').get();
    const allQuestions = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      allQuestions.push({
        id: doc.id,
        questionnaire_id: data.questionnaire_id,
        text: data.text,
        type: data.type,
        order: data.order || data.order_index
      });
    });

    console.log(`🔍 DEBUG: Total de questões no banco: ${allQuestions.length}`);

    res.json({
      total: allQuestions.length,
      questions: allQuestions
    });

  } catch (error) {
    console.error('❌ Erro no debug de questões:', error);
    res.status(500).json({ error: error.message });
  }
});

// Migração para estrutura embedded - protegida por admin
app.post('/api/migrate-to-embedded', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('🔄 INICIANDO MIGRAÇÃO para estrutura embedded...');

    // 1. Buscar todos os questionários
    const questionnairesSnapshot = await db.collection('questionnaires').get();
    let migratedCount = 0;

    for (const questionnaireDoc of questionnairesSnapshot.docs) {
      const questionnaireData = questionnaireDoc.data();
      const questionnaireId = questionnaireDoc.id;

      console.log(`📝 Migrando questionário: ${questionnaireData.title}`);

      // 2. Buscar questões da coleção separada
      const questionsSnapshot = await db.collection('questions')
        .where('questionnaire_id', '==', questionnaireId)
        .get();

      const embeddedQuestions = [];
      questionsSnapshot.forEach(questionDoc => {
        const questionData = questionDoc.data();
        embeddedQuestions.push({
          id: questionDoc.id,
          text: questionData.text,
          type: questionData.type,
          options: questionData.options ? JSON.parse(questionData.options) : null,
          order: questionData.order || questionData.order_index || 0,
          is_required: questionData.is_required !== false
        });
      });

      // Ordenar questões por order
      embeddedQuestions.sort((a, b) => a.order - b.order);

      // 3. Atualizar questionário com questões embedded
      await db.collection('questionnaires').doc(questionnaireId).update({
        questions: embeddedQuestions,
        updated_at: FieldValue.serverTimestamp()
      });

      console.log(`✅ Questionário ${questionnaireData.title} migrado com ${embeddedQuestions.length} questões`);
      migratedCount++;
    }

    console.log(`🎉 MIGRAÇÃO CONCLUÍDA: ${migratedCount} questionários migrados`);

    res.json({
      success: true,
      message: `Migração concluída com sucesso`,
      questionnaires_migrated: migratedCount
    });

  } catch (error) {
    console.error('❌ Erro na migração:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Migração para normalizar usernames existentes (protegida por admin)
app.post('/api/auth/migrate-usernames', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('users').get();
    let count = 0;
    const batch = db.batch();

    snapshot.forEach(doc => {
      const data = doc.data();
      const oldUsername = data.username;
      const newUsername = normalizeUsername(oldUsername);

      if (oldUsername && oldUsername !== newUsername) {
        batch.update(doc.ref, { username: newUsername });
        count++;
      }
    });

    await batch.commit();
    res.json({ success: true, message: `${count} usernames normalizados com sucesso.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/questionnaires', authenticateToken, async (req, res) => {
  try {
    const [qSnapshot, uSnapshot, sSnapshot] = await Promise.all([
      db.collection('questionnaires').get(),
      db.collection('users').get(),
      db.collection('response_sessions').get()
    ]);

    // Contar apenas usuários que não são administradores para o engajamento
    const activeUsers = uSnapshot.docs.filter(doc => {
      const role = (doc.data().role || '').toLowerCase();
      return role !== 'admin' && role !== 'administrator';
    });

    const totalCollaborators = activeUsers.length || 1; // Evita divisão por zero
    const sessions = sSnapshot.docs.map(doc => doc.data());

    const questionnaires = qSnapshot.docs.map(doc => {
      const qData = doc.data();
      const qId = doc.id;

      // Contar usuários únicos que responderam este questionário específico
      const uniqueRespondents = new Set(
        sessions
          .filter(s => s.questionnaire_id === qId && s.user_id)
          .map(s => s.user_id)
      ).size;

      // Cálculo Real de Engajamento (Baseado em Colaboradores Ativos)
      const engagementRate = Math.round((uniqueRespondents / totalCollaborators) * 100);

      // Tratamento de Data para evitar "Invalid Date"
      let createdAtIso = null;
      if (qData.created_at) {
        createdAtIso = typeof qData.created_at.toDate === 'function'
          ? qData.created_at.toDate().toISOString()
          : new Date(qData.created_at).toISOString();
      }

      return {
        id: qId,
        ...qData,
        status: qData.status || (qData.is_active === false ? 'finished' : 'active'),
        created_at: createdAtIso,
        updated_at: qData.updated_at?.toDate?.()?.toISOString() || qData.updated_at,
        engagement_rate: engagementRate,
        respondents_count: uniqueRespondents,
        total_collaborators_count: totalCollaborators
      };
    });

    // Ordenar por data de criação (mais recente primeiro)
    questionnaires.sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB - dateA;
    });

    res.json(questionnaires);
  } catch (error) {
    console.error('Erro ao listar questionários:', error);
    res.status(500).json({ error: 'Erro interno ao buscar dados' });
  }
});


// === ROTAS DE AUTENTICAÇÃO ===

// Dados biométricos para login facial — sem token de usuário ainda,
// mas protegido por uma chave de API estática do cliente (BIOMETRIC_CLIENT_KEY).
// Retorna APENAS os descritores faciais e IDs, sem dados pessoais.
app.get('/api/auth/biometric-data', async (req, res) => {
  try {
    // Verificar chave de cliente para evitar acesso público irrestrito
    const clientKey = req.headers['x-biometric-key'];
    if (!clientKey || clientKey !== process.env.BIOMETRIC_CLIENT_KEY) {
      return res.status(401).json({ error: 'Acesso não autorizado' });
    }

    const snapshot = await db.collection('users').where('is_active', '==', true).get();
    const users = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.face_descriptor) {
        // Retorna apenas o mínimo necessário para comparação — sem nome, email ou foto
        users.push({
          id: doc.id,
          face_descriptor: data.face_descriptor
        });
      }
    });
    res.json(users);
  } catch (error) {
    console.error('Erro biometric-data:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

app.post('/api/auth/login-biometric', async (req, res) => {
  try {
    const { userId, descriptor } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID requerido' });
    if (!descriptor || !Array.isArray(descriptor) || descriptor.length !== 128) {
      return res.status(400).json({ error: 'Descritor facial inválido' });
    }

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'Usuário não encontrado' });

    const userData = userDoc.data();

    if (!userData.is_active) {
      return res.status(401).json({ error: 'Usuário inativo' });
    }

    // Validação biométrica no servidor — impede que qualquer userId seja aceito sem rosto
    if (!userData.face_descriptor) {
      return res.status(401).json({ error: 'Usuário sem biometria cadastrada' });
    }

    const savedDescriptor = Array.isArray(userData.face_descriptor)
      ? userData.face_descriptor
      : Object.values(userData.face_descriptor);

    const distance = getFaceDistance(descriptor, savedDescriptor);
    console.log(`🔐 Validação biométrica server-side para ${userData.username}: distância ${distance.toFixed(4)}`);

    if (distance >= 0.55) {
      return res.status(401).json({ error: 'Biometria não confirmada pelo servidor' });
    }

    // Gerar JWT real apenas após validação server-side
    const token = jwt.sign(
      { id: userDoc.id, username: userData.username, role: userData.role || 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: userDoc.id,
        username: userData.username,
        full_name: userData.full_name,
        email: userData.email,
        role: userData.role || 'user'
      }
    });
  } catch (error) {
    console.error('Erro login-biometric:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username e password são obrigatórios' });
    }

    const cleanUsername = normalizeUsername(username);
    console.log(`🔑 Tentativa de login para: ${cleanUsername}`);

    // Buscar usuário no Firestore
    const userSnapshot = await db.collection('users')
      .where('username', '==', cleanUsername)
      .limit(1)
      .get();

    if (userSnapshot.empty) {
      console.log(`❌ Usuário não encontrado: ${username}`);
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();

    // Verificar senha
    const isValidPassword = await bcrypt.compare(password, userData.password_hash);

    if (!isValidPassword) {
      console.log(`❌ Senha inválida para usuário: ${username}`);
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Verificar se usuário está ativo
    if (!userData.is_active) {
      console.log(`❌ Usuário inativo: ${username}`);
      return res.status(401).json({ error: 'Usuário inativo' });
    }

    // Gerar JWT
    const token = jwt.sign(
      {
        id: userDoc.id,
        username: userData.username,
        role: userData.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`✅ Login bem-sucedido para: ${username}`);

    res.json({
      success: true,
      user: {
        id: userDoc.id,
        username: userData.username,
        full_name: userData.full_name,
        email: userData.email,
        role: userData.role
      },
      token
    });

  } catch (error) {
    console.error('❌ Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Registro de usuário
app.post('/api/auth/register', async (req, res) => {
  try {
    const {
      username, full_name, email, password,
      role, face_photo, face_descriptor,
      phone = '', address = ''
    } = req.body;

    // Bloquear auto-atribuição de role admin via registro público
    const safeRole = 'user';
    // Validações
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email e password são obrigatórios' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password deve ter pelo menos 6 caracteres' });
    }

    console.log(`📝 Tentativa de registro para: ${username}`);

    const cleanUsername = normalizeUsername(username);

    // Verificar se username já existe
    const usernameSnapshot = await db.collection('users')
      .where('username', '==', cleanUsername)
      .limit(1)
      .get();

    if (!usernameSnapshot.empty) {
      return res.status(400).json({ error: 'Username já existe' });
    }

    // Verificar se email já existe
    const emailSnapshot = await db.collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (!emailSnapshot.empty) {
      return res.status(400).json({ error: 'Email já existe' });
    }

    // Verificar duplicidade biométrica
    if (face_descriptor) {
      const allUsersSnap = await db.collection('users').get();
      let biometricMatch = null;

      allUsersSnap.forEach(doc => {
        const u = doc.data();
        if (u.face_descriptor) {
          const dist = getFaceDistance(face_descriptor, u.face_descriptor);
          if (dist < 0.55) {
            biometricMatch = u.full_name;
          }
        }
      });

      if (biometricMatch) {
        return res.status(400).json({
          error: `BLOQUEIO BIOMÉTRICO: Esta biometria já pertence a ${biometricMatch}.`
        });
      }
    }

    // Verificar se já existe alguém com o MESMO NOME e MESMO TELEFONE
    // Isso permite homônimos (pessoas com mesmo nome) desde que tenham telefones diferentes
    if (full_name) {
      const duplicateSnapshot = await db.collection('users')
        .where('full_name', '==', full_name)
        .where('phone', '==', phone)
        .limit(1)
        .get();

      if (!duplicateSnapshot.empty) {
        return res.status(400).json({
          error: 'Já existe um cadastro com este mesmo nome e telefone. Verifique se a pessoa já possui conta.'
        });
      }
    }

    // Hash da senha
    const password_hash = await bcrypt.hash(password, 12);

    // Criar usuário no Firestore
    const newUser = {
      username: cleanUsername,
      full_name: full_name || username,
      email,
      phone: phone || '',
      address: address || '',
      password_hash,
      role: safeRole,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
      is_active: true
    };

    // Anexar biometria se fornecida
    if (face_photo) newUser.face_photo = face_photo;
    if (face_descriptor) newUser.face_descriptor = face_descriptor;

    const userRef = await db.collection('users').add(newUser);

    console.log(`✅ Usuário criado com sucesso: ${username} (ID: ${userRef.id})`);

    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso',
      user: {
        id: userRef.id,
        username,
        full_name: full_name || username,
        email,
        role
      }
    });

  } catch (error) {
    console.error('❌ Erro no registro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// 1. Listar todos os usuários (Para a tela de Usuários)
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('👥 Listando usuários...');

    // Busca todos na coleção 'users'
    const snapshot = await db.collection('users').get();
    const users = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      users.push({
        id: doc.id,
        username: data.username,
        full_name: data.full_name,
        email: data.email,
        role: data.role,
        is_active: data.is_active,
        face_photo: data.face_photo || null,
        face_descriptor: data.face_descriptor || null
      });
    });

    console.log(`✅ ${users.length} usuários encontrados`);
    res.json(users);

  } catch (error) {
    console.error('❌ Erro ao listar usuários:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// 2. Deletar usuário
app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Segurança: Admin não pode excluir a si mesmo
    if (req.user && id === req.user.id) {
      return res.status(400).json({ error: 'Você não pode excluir a si mesmo.' });
    }

    console.log(`🗑️ Removendo usuário ID: ${id}`);
    await db.collection('users').doc(id).delete();

    res.json({ message: 'Usuário removido com sucesso' });

  } catch (error) {
    console.error('❌ Erro ao deletar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// 3. Atualizar usuário
app.put('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, email, phone, address, role, username, face_photo, face_descriptor, password } = req.body;

    console.log(`✏️ Atualizando usuário ID: ${id}`);

    // Verifica se usuário existe
    const docRef = db.collection('users').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Verificar duplicidade biométrica (se estiver alterando a foto)
    if (face_descriptor) {
      const allUsersSnap = await db.collection('users').get();
      let biometricMatch = null;

      allUsersSnap.forEach(userDoc => {
        if (userDoc.id === id) return; // Ignorar o próprio usuário

        const u = userDoc.data();
        if (u.face_descriptor) {
          const dist = getFaceDistance(face_descriptor, u.face_descriptor);
          if (dist < 0.55) {
            biometricMatch = u.full_name;
          }
        }
      });

      if (biometricMatch) {
        return res.status(400).json({
          error: `BLOQUEIO BIOMÉTRICO: Esta biometria já pertence a ${biometricMatch}.`
        });
      }
    }

    // Preparar objeto de update com os campos que vieram no body
    const updates = {
      updated_at: FieldValue.serverTimestamp()
    };

    if (full_name !== undefined) updates.full_name = full_name;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (address !== undefined) updates.address = address;
    if (role !== undefined) updates.role = role;
    if (username !== undefined) updates.username = username;
    if (face_photo !== undefined) updates.face_photo = face_photo;
    if (face_descriptor !== undefined) updates.face_descriptor = face_descriptor;

    // Se houver nova senha, criptografar antes de salvar
    if (password && password.length >= 6) {
      console.log('🔐 Atualizando senha do usuário...');
      updates.password_hash = await bcrypt.hash(password, 12);
    }

    await docRef.update(updates);

    console.log(`✅ Usuário atualizado com sucesso: ${id}`);
    res.json({ success: true, message: 'Usuário atualizado com sucesso' });

  } catch (error) {
    console.error('❌ Erro ao atualizar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});



// Listar questionários ativos (para usuários comuns)
app.get('/api/questionnaires/active', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.query;
    const currentUserId = userId || req.user.id;

    console.log(`📋 Buscando questionários ativos para usuário: ${currentUserId}`);

    // Consulta simples para questionários ativos com questões
    const questionnaireSnapshot = await db.collection('questionnaires').get();

    // Buscar respostas do usuário para filtrar questionários já respondidos
    let userResponsedQuestionnaireIds = [];
    let responsesSnapshot = { docs: [] }; // Inicializado fora para evitar erro de escopo (FIM DO BUG)

    if (currentUserId) {
      console.log('🔍 Verificando questionários já respondidos...');
      const userIdString = String(currentUserId);

      responsesSnapshot = await db.collection('response_sessions')
        .where('user_id', '==', userIdString)
        .get();

      console.log(`📊 Encontradas ${responsesSnapshot.docs.length} sessões de resposta`);

      userResponsedQuestionnaireIds = responsesSnapshot.docs.map(doc => doc.data().questionnaire_id);
    }

    const activeQuestionnaires = [];

    // Mapear sessões recentes por questionário em memória para evitar consultas complexas e erros de índice
    const userSessionsMap = {};
    if (currentUserId) {
      responsesSnapshot.forEach(doc => {
        const data = doc.data();
        const qId = data.questionnaire_id;
        // Guardar apenas a mais recente (baseado no created_at)
        if (!userSessionsMap[qId] || data.created_at > userSessionsMap[qId].created_at) {
          userSessionsMap[qId] = {
            id: doc.id,
            ...data
          };
        }
      });
    }

    // Melhorado: Verificar se usuário já respondeu a TODAS as perguntas atuais
    for (const doc of questionnaireSnapshot.docs) {
      const data = doc.data();
      const questionnaireId = doc.id;
      const status = data.status || (data.is_active === false ? 'finished' : 'active');

      // APENAS STATUS "ACTIVE" aparece no dashboard do usuário
      if (status === 'active' && data.questions && data.questions.length > 0) {

        const lastSession = userSessionsMap[questionnaireId];

        // Se usuário respondeu, precisamos checar se respondeu a TUDO
        if (lastSession) {
          const sessionId = lastSession.id;

          // Buscar respostas desta sessão específica
          const responsesCountSnapshot = await db.collection('responses')
            .where('session_id', '==', sessionId)
            .get();

          const answeredQuestionIds = responsesCountSnapshot.docs.map(r => r.data().question_id);
          const currentQuestionIds = data.questions.map(q => q.id);

          // Se houver perguntas no questionário que não estão na sessão respondida, reabrir!
          const hasNewQuestions = currentQuestionIds.some(id => !answeredQuestionIds.includes(id));

          if (hasNewQuestions) {
            activeQuestionnaires.push({
              id: questionnaireId,
              title: data.title + " (Novas Perguntas)",
              description: data.description,
              created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at,
              question_count: data.questions.length,
              is_partial: true,
              last_session_id: sessionId
            });
          }
          // Caso contrário (já respondeu tudo), não adicionamos nada (sumiu das pendências)
        } else {
          // Não respondeu nada ainda (não existe sessão mapeada)
          activeQuestionnaires.push({
            id: questionnaireId,
            title: data.title,
            description: data.description,
            created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at,
            question_count: data.questions.length
          });
        }
      }
    }

    // Ordenar por data de criação (mais recente primeiro)
    activeQuestionnaires.sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB - dateA;
    });

    console.log(`✅ ${activeQuestionnaires.length} questionários ativos encontrados`);
    res.json(activeQuestionnaires);

  } catch (error) {
    console.error('❌ Erro ao buscar questionários ativos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Buscar questionário por ID
app.get('/api/questionnaires/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const doc = await db.collection('questionnaires').doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Questionário não encontrado' });
    }

    const data = doc.data();
    const questionnaire = {
      id: doc.id,
      ...data,
      created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at,
      updated_at: data.updated_at?.toDate?.()?.toISOString() || data.updated_at
    };

    res.json(questionnaire);

  } catch (error) {
    console.error('❌ Erro ao buscar questionário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar novo questionário (com questões embedded)
app.post('/api/questionnaires', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, description, engagement_goal, questions = [] } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Título é obrigatório' });
    }

    console.log(`📝 Criando questionário: ${title} com ${questions.length} questões`);

    // Processar questões para estrutura embedded
    const processedQuestions = questions.map((question, index) => ({
      id: question.id || `q${index + 1}`,
      text: question.text,
      type: question.type,
      options: question.options || null,
      order: question.order || index + 1,
      is_required: question.is_required !== false // default true
    }));

    const newQuestionnaire = {
      title,
      description: description || '',
      engagement_goal: engagement_goal !== undefined ? Number(engagement_goal) : 80,
      created_by: req.user.id,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
      status: 'draft', // Todo novo questionário começa como rascunho
      questions: processedQuestions  // 🔥 QUESTÕES EMBEDDED
    };

    const docRef = await db.collection('questionnaires').add(newQuestionnaire);

    console.log(`✅ Questionário criado: ${docRef.id} com ${processedQuestions.length} questões embedded`);

    res.status(201).json({
      success: true,
      id: docRef.id,
      message: 'Questionário criado com sucesso',
      questions_count: processedQuestions.length
    });

  } catch (error) {
    console.error('❌ Erro ao criar questionário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar status do questionário (Publicar/Finalizar/Rascunho)
app.patch('/api/questionnaires/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status é obrigatório' });
    }

    console.log(`📡 Atualizando status do questionário ${id} para: ${status}`);

    const updates = {
      status,
      // Legado: is_active mantém compatibilidade com versões antigas
      is_active: status === 'active',
      updated_at: FieldValue.serverTimestamp()
    };

    await db.collection('questionnaires').doc(id).update(updates);

    res.json({ success: true, message: `Status atualizado para ${status}` });
  } catch (error) {
    console.error('❌ Erro PATCH status:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Atualizar questionário
app.put('/api/questionnaires/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, engagement_goal } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Título é obrigatório' });
    }

    console.log(`✏️ Atualizando questionário: ${id}`);

    const updates = {
      title,
      description: description || '',
      updated_at: FieldValue.serverTimestamp()
    };

    if (engagement_goal !== undefined) {
      updates.engagement_goal = Number(engagement_goal);
    }

    await db.collection('questionnaires').doc(id).update(updates);

    console.log(`✅ Questionário atualizado: ${id}`);

    res.json({
      success: true,
      message: 'Questionário atualizado com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar questionário:', error);
    if (error.code === 'not-found') {
      res.status(404).json({ error: 'Questionário não encontrado' });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

// Deletar questionário (HARD DELETE - Remoção Total)
app.delete('/api/questionnaires/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🗑️ Deletando questionário TOTALMENTE: ${id}`);

    // Iniciar um batch para garantir atomicidade (máx 500 ops)
    const batch = db.batch();

    // 1. Buscar e marcar para deletar todas as sessões deste questionário
    const sessionsSnap = await db.collection('response_sessions')
      .where('questionnaire_id', '==', id)
      .get();

    console.log(`📊 Removendo ${sessionsSnap.size} sessões relacionadas`);

    for (const sessionDoc of sessionsSnap.docs) {
      const sessionId = sessionDoc.id;

      // 2. Buscar e marcar para deletar todas as respostas vinculadas a cada sessão
      const responsesSnap = await db.collection('responses')
        .where('session_id', '==', sessionId)
        .get();

      responsesSnap.forEach(respDoc => {
        batch.delete(respDoc.ref);
      });

      // Deletar a sessão em si
      batch.delete(sessionDoc.ref);
    }

    // 3. Deletar o questionário (questions embedded já vão junto)
    batch.delete(db.collection('questionnaires').doc(id));

    // Executar o batch
    await batch.commit();

    console.log(`✅ Questionário, sessões e respostas deletados: ${id}`);

    res.json({
      success: true,
      message: 'Questionário e todos os dados vinculados foram removidos permanentemente'
    });

  } catch (error) {
    console.error('❌ Erro ao deletar questionário permanentemente:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao processar exclusão' });
  }
});

// ⚠️ LIMPAR TODAS AS RESPOSTAS (apenas admin)
app.delete('/api/responses/clear-all', authenticateToken, async (req, res) => {
  try {
    // Verificar se é admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Apenas administradores podem limpar respostas' });
    }

    console.log('🧹 LIMPANDO TODAS AS RESPOSTAS...');

    let deletedResponses = 0;
    let deletedSessions = 0;

    // 1. Deletar todas as respostas
    const responsesSnapshot = await db.collection('responses').get();
    const responseBatch = db.batch();
    responsesSnapshot.docs.forEach(doc => {
      responseBatch.delete(doc.ref);
      deletedResponses++;
    });
    if (deletedResponses > 0) {
      await responseBatch.commit();
    }
    console.log(`🗑️ ${deletedResponses} respostas deletadas`);

    // 2. Deletar todas as sessões de resposta
    const sessionsSnapshot = await db.collection('response_sessions').get();
    const sessionBatch = db.batch();
    sessionsSnapshot.docs.forEach(doc => {
      sessionBatch.delete(doc.ref);
      deletedSessions++;
    });
    if (deletedSessions > 0) {
      await sessionBatch.commit();
    }
    console.log(`🗑️ ${deletedSessions} sessões deletadas`);

    console.log('✅ TODAS AS RESPOSTAS FORAM LIMPAS!');

    res.json({
      success: true,
      message: 'Todas as respostas foram limpas',
      deleted: {
        responses: deletedResponses,
        sessions: deletedSessions
      }
    });

  } catch (error) {
    console.error('❌ Erro ao limpar respostas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// === ROTAS DE QUESTÕES ===

// Buscar questões de um questionário (estrutura embedded - MUITO MAIS SIMPLES!)
app.get('/api/questionnaires/:id/questions', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`❓ Buscando questões do questionário: ${id}`);

    // UMA SÓ CONSULTA! 🔥
    const doc = await db.collection('questionnaires').doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Questionário não encontrado' });
    }

    const data = doc.data();
    const questions = data.questions || [];

    // Ordenar por order
    questions.sort((a, b) => (a.order || 0) - (b.order || 0));

    console.log(`✅ ${questions.length} questões encontradas (embedded)`);
    res.json(questions);

  } catch (error) {
    console.error('❌ Erro ao buscar questões:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Adicionar questão a um questionário (estrutura embedded)
app.post('/api/questionnaires/:id/questions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id: questionnaireId } = req.params;
    const { text, type, options = null, order, is_required = true } = req.body;

    if (!text || !type) {
      return res.status(400).json({ error: 'text e type são obrigatórios' });
    }

    console.log(`❓ Adicionando questão ao questionário: ${questionnaireId}`);

    // Buscar o questionário
    const questionnaireRef = db.collection('questionnaires').doc(questionnaireId);
    const questionnaireDoc = await questionnaireRef.get();

    if (!questionnaireDoc.exists) {
      return res.status(404).json({ error: 'Questionário não encontrado' });
    }

    const questionnaireData = questionnaireDoc.data();
    const currentQuestions = questionnaireData.questions || [];

    // Gerar ID único para a questão
    const questionId = `q${currentQuestions.length + 1}`;

    const newQuestion = {
      id: questionId,
      text,
      type,
      options: options || null,
      order: order || currentQuestions.length + 1,
      is_required
    };

    // Adicionar a nova questão ao array
    const updatedQuestions = [...currentQuestions, newQuestion];

    // Atualizar o documento
    await questionnaireRef.update({
      questions: updatedQuestions,
      updated_at: FieldValue.serverTimestamp()
    });

    console.log(`✅ Questão adicionada: ${questionId}`);

    res.status(201).json({
      success: true,
      id: questionId,
      message: 'Questão adicionada com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao adicionar questão:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar questão específica em questionário (estrutura embedded)
app.put('/api/questionnaires/:questionnaireId/questions/:questionId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { questionnaireId, questionId } = req.params;
    const { text, type, options, order, is_required } = req.body;

    console.log(`✏️ Atualizando questão ${questionId} do questionário ${questionnaireId}`);

    // Buscar o questionário
    const questionnaireRef = db.collection('questionnaires').doc(questionnaireId);
    const questionnaireDoc = await questionnaireRef.get();

    if (!questionnaireDoc.exists) {
      return res.status(404).json({ error: 'Questionário não encontrado' });
    }

    const questionnaireData = questionnaireDoc.data();
    const questions = questionnaireData.questions || [];

    // Encontrar e atualizar a questão
    const questionIndex = questions.findIndex(q => q.id === questionId);

    if (questionIndex === -1) {
      return res.status(404).json({ error: 'Questão não encontrada' });
    }

    // Atualizar apenas os campos fornecidos
    if (text !== undefined) questions[questionIndex].text = text;
    if (type !== undefined) questions[questionIndex].type = type;
    if (options !== undefined) questions[questionIndex].options = options;
    if (order !== undefined) questions[questionIndex].order = order;
    if (is_required !== undefined) questions[questionIndex].is_required = is_required;

    // Atualizar o documento
    await questionnaireRef.update({
      questions: questions,
      updated_at: FieldValue.serverTimestamp()
    });

    console.log(`✅ Questão atualizada: ${questionId}`);

    res.json({
      success: true,
      message: 'Questão atualizada com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar questão:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Deletar questão específica de questionário (estrutura embedded)
app.delete('/api/questionnaires/:questionnaireId/questions/:questionId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { questionnaireId, questionId } = req.params;

    console.log(`🗑️ Deletando questão ${questionId} do questionário ${questionnaireId}`);

    // Buscar o questionário
    const questionnaireRef = db.collection('questionnaires').doc(questionnaireId);
    const questionnaireDoc = await questionnaireRef.get();

    if (!questionnaireDoc.exists) {
      return res.status(404).json({ error: 'Questionário não encontrado' });
    }

    const questionnaireData = questionnaireDoc.data();
    const questions = questionnaireData.questions || [];

    // Filtrar para remover a questão
    const updatedQuestions = questions.filter(q => q.id !== questionId);

    if (updatedQuestions.length === questions.length) {
      return res.status(404).json({ error: 'Questão não encontrada' });
    }

    // Atualizar o documento
    await questionnaireRef.update({
      questions: updatedQuestions,
      updated_at: FieldValue.serverTimestamp()
    });

    console.log(`✅ Questão deletada: ${questionId}`);

    res.json({
      success: true,
      message: 'Questão deletada com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao deletar questão:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// === ROTAS DE RESPOSTAS ===

// Criar sessão de resposta (para questionário completo)
app.post('/api/responses/session', authenticateToken, async (req, res) => {
  try {
    const { questionnaire_id, respondent_name, respondent_age = null, user_id = null } = req.body;

    if (!questionnaire_id || !respondent_name) {
      return res.status(400).json({ error: 'questionnaire_id e respondent_name são obrigatórios' });
    }

    console.log(`📝 Criando sessão de resposta para questionário: ${questionnaire_id}`);
    console.log(`👤 User ID recebido: ${user_id}`);
    console.log(`👤 User ID do token: ${req.user.id}`);

    const finalUserId = String(user_id || req.user.id); // Garantir que seja string
    console.log(`👤 User ID final que será salvo (como string): ${finalUserId}`);

    const newSession = {
      questionnaire_id,
      respondent_name,
      respondent_age: respondent_age || null,
      user_id: finalUserId,
      created_at: FieldValue.serverTimestamp(),
      completed_at: null
    };

    console.log(`💾 Dados da sessão a ser criada:`, newSession);

    const docRef = await db.collection('response_sessions').add(newSession);

    console.log(`✅ Sessão de resposta criada: ${docRef.id}`);

    res.status(201).json({
      success: true,
      session_id: docRef.id,
      message: 'Sessão de resposta criada com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao criar sessão de resposta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Salvar resposta
app.post('/api/responses', authenticateToken, async (req, res) => {
  try {
    const { question_id, value, session_id = null, numeric_value = null } = req.body;

    if (!question_id || value === undefined) {
      return res.status(400).json({ error: 'question_id e value são obrigatórios' });
    }

    console.log(`💬 Salvando resposta para questão: ${question_id}`);

    const newResponse = {
      question_id,
      user_id: req.user.id,
      value: typeof value === 'string' ? value : JSON.stringify(value),
      numeric_value: numeric_value,
      session_id: session_id,
      created_at: FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('responses').add(newResponse);

    console.log(`✅ Resposta salva: ${docRef.id}`);

    res.status(201).json({
      success: true,
      id: docRef.id,
      message: 'Resposta salva com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao salvar resposta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Salvar múltiplas respostas em batch (otimizado)
app.post('/api/responses/batch', authenticateToken, async (req, res) => {
  try {
    const { session_id, responses } = req.body;

    if (!session_id || !responses || !Array.isArray(responses)) {
      return res.status(400).json({ error: 'session_id e responses (array) são obrigatórios' });
    }

    console.log(`💬 Salvando ${responses.length} respostas em batch para sessão: ${session_id}`);

    // Usar batch do Firestore para salvar todas de uma vez
    const batch = db.batch();
    const savedIds = [];

    for (const response of responses) {
      const { question_id, value, numeric_value = null } = response;

      if (!question_id || value === undefined) {
        continue; // Pular respostas inválidas
      }

      const docRef = db.collection('responses').doc();
      batch.set(docRef, {
        question_id,
        user_id: req.user.id,
        value: typeof value === 'string' ? value : JSON.stringify(value),
        numeric_value: numeric_value,
        session_id: session_id,
        created_at: FieldValue.serverTimestamp()
      });

      savedIds.push(docRef.id);
    }

    // Commit do batch - todas as escritas acontecem de uma vez
    await batch.commit();

    console.log(`✅ ${savedIds.length} respostas salvas em batch!`);

    res.status(201).json({
      success: true,
      count: savedIds.length,
      ids: savedIds,
      message: `${savedIds.length} respostas salvas com sucesso`
    });

  } catch (error) {
    console.error('❌ Erro ao salvar respostas em batch:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Verificar se usuário já respondeu um questionário específico
app.get('/api/users/:userId/questionnaires/:questionnaireId/answered', authenticateToken, async (req, res) => {
  try {
    const { userId, questionnaireId } = req.params;

    console.log(`🎯 ENDPOINT CORRETO CHAMADO! Usuário ${userId} x Questionário ${questionnaireId}`);
    console.log(`🔐 Usuário do token: ${req.user.id} (${req.user.username})`);
    console.log(`🔐 Usuário da URL: ${userId}`);

    // Verificar se o usuário pode acessar essas informações
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      console.log(`❌ ACESSO NEGADO! User do token (${req.user.id}) != User da URL (${userId})`);
      return res.status(403).json({ error: 'Acesso negado - você só pode verificar suas próprias respostas' });
    }

    console.log(`✅ ACESSO AUTORIZADO! Verificando respostas...`);

    // Buscar se existe uma sessão de resposta para este usuário e questionário
    const snapshot = await db.collection('response_sessions')
      .where('user_id', '==', String(userId))
      .where('questionnaire_id', '==', questionnaireId)
      .limit(1)
      .get();

    const answered = !snapshot.empty;

    if (answered) {
      const sessionData = snapshot.docs[0].data();
      console.log(`✅ ENCONTROU SESSÃO! Usuário JÁ RESPONDEU`, {
        sessionId: snapshot.docs[0].id,
        respondent_name: sessionData.respondent_name,
        created_at: sessionData.created_at?.toDate?.()?.toISOString()
      });
    } else {
      console.log(`❌ NENHUMA SESSÃO ENCONTRADA - Usuário NÃO RESPONDEU ainda`);
    }

    res.json({ answered });

  } catch (error) {
    console.error('❌ Erro ao verificar resposta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Buscar respostas de um questionário
app.get('/api/questionnaires/:id/responses', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`💬 Buscando respostas do questionário: ${id}`);

    // 1. Buscar detalhes do questionário para pegar as questões embedded
    const questionnaireDoc = await db.collection('questionnaires').doc(id).get();

    if (!questionnaireDoc.exists) {
      return res.status(404).json({ error: 'Questionário não encontrado' });
    }
    const qData = questionnaireDoc.data();

    // Buscar todas as sessões deste questionário (Removido o filtro de lotes para o Admin)
    const sessionsSnap = await db.collection('response_sessions')
      .where('questionnaire_id', '==', id)
      .get();

    const allSessions = sessionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const sessionIds = new Set(allSessions.map(s => s.id));

    const questionIds = (qData.questions || []).map(q => q.id);

    if (questionIds.length === 0 || sessionIds.size === 0) {
      return res.json([]);
    }

    // Buscar respostas apenas para as sessões liberadas
    const responses = [];

    // Firestore tem limite de 10 itens em consultas 'in', então fazemos em lotes
    const batchSize = 10;
    for (let i = 0; i < questionIds.length; i += batchSize) {
      const qBatch = questionIds.slice(i, i + batchSize);

      const snapshot = await db.collection('responses')
        .where('question_id', 'in', qBatch)
        .get();

      snapshot.forEach(doc => {
        const data = doc.data();
        // Filtrar apenas respostas das sessões encontradas
        if (sessionIds.has(data.session_id)) {
          responses.push({
            id: doc.id,
            ...data,
            created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at
          });
        }
      });
    }

    // Ordenar respostas por data de criação (mais recente primeiro)
    responses.sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB - dateA;
    });

    console.log(`✅ ${responses.length} respostas encontradas`);
    res.json(responses);

  } catch (error) {
    console.error('❌ Erro ao buscar respostas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Buscar respostas de um usuário
app.get('/api/users/:userId/responses', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verificar se o usuário pode acessar essas respostas
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    console.log(`💬 Buscando respostas do usuário: ${userId}`);

    const snapshot = await db.collection('responses')
      .where('user_id', '==', userId)
      .get();

    const responses = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      responses.push({
        id: doc.id,
        ...data,
        created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at
      });
    });

    // Ordenar respostas por data de criação (mais recente primeiro)
    responses.sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB - dateA;
    });

    console.log(`✅ ${responses.length} respostas encontradas`);
    res.json(responses);

  } catch (error) {
    console.error('❌ Erro ao buscar respostas do usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// === ROTAS DE ESTATÍSTICAS ===

// Estatísticas específicas de um questionário
app.get('/api/questionnaires/:id/statistics', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`📊 Gerando estatísticas para questionário: ${id}`);

    // Buscar o questionário
    const questionnaireDoc = await db.collection('questionnaires').doc(id).get();

    if (!questionnaireDoc.exists) {
      return res.status(404).json({ error: 'Questionário não encontrado' });
    }

    const questionnaireData = questionnaireDoc.data();
    const questions = questionnaireData.questions || [];

    // Buscar sessões e aplicar lotes
    const sessionsSnap = await db.collection('response_sessions')
      .where('questionnaire_id', '==', id)
      .get();
    const allSessions = sessionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Buscar usuários para saber o total possível
    const usersSnap = await db.collection('users').get();
    const activeUsers = usersSnap.docs.filter(d => d.data().role !== 'admin' && d.data().is_active !== false);
    const totalPossible = activeUsers.length;

    const { releasedSessions } = getReleasedSessions(allSessions, 5, { [id]: totalPossible });
    const releasedSessionIds = new Set(releasedSessions.map(s => s.id));

    // Contar respostas para este questionário (apenas de sessões liberadas)
    let totalResponsesCount = 0;
    const questionStats = [];

    for (const question of questions) {
      const responsesSnapshot = await db.collection('responses')
        .where('question_id', '==', question.id)
        .get();

      const releasedResponses = responsesSnapshot.docs.filter(doc => releasedSessionIds.has(doc.data().session_id));
      const count = releasedResponses.length;
      totalResponsesCount += count;

      questionStats.push({
        questionId: question.id,
        questionText: question.text,
        type: question.type,
        responses: count
      });
    }

    // 4. Identificar Usuários Pendentes para este questionário

    const allRespondentIds = new Set(allSessions.map(s => String(s.user_id)));
    const releasedRespondentIds = new Set(releasedSessions.map(s => String(s.user_id)));

    const pendingUsers = [];
    usersSnap.forEach(doc => {
      const u = doc.data();
      // Usuário é pendente se não respondeu OU se respondeu mas não foi liberado
      if (u.role !== 'admin' && !releasedRespondentIds.has(String(doc.id))) {
        pendingUsers.push({
          id: doc.id,
          full_name: u.full_name,
          username: u.username,
          has_responded: allRespondentIds.has(String(doc.id)) // Útil para saber se está só aguardando lote
        });
      }
    });

    const statistics = {
      questionnaireId: id,
      title: questionnaireData.title,
      totalQuestions: questions.length,
      totalResponses: totalResponsesCount,
      averageResponsesPerQuestion: questions.length > 0 ? Math.round(totalResponsesCount / questions.length) : 0,
      completionRate: questions.length > 0 ? Math.round((totalResponsesCount / questions.length) * 100) : 0,
      questionStats,
      pendingUsers,
      batchSize: 5,
      isBatchRelease: true
    };

    console.log(`✅ Estatísticas geradas para questionário ${id}`);
    res.json(statistics);

  } catch (error) {
    console.error('❌ Erro ao gerar estatísticas do questionário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});


// Estatísticas específicas de uma questão
app.get('/api/questions/:questionId/statistics', authenticateToken, async (req, res) => {
  try {
    const { questionId } = req.params;

    console.log(`📊 Gerando estatísticas para questão: ${questionId}`);

    // Buscar todas as respostas para esta questão específica
    const responsesSnapshot = await db.collection('responses')
      .where('question_id', '==', questionId)
      .get();

    console.log(`🔍 Encontradas ${responsesSnapshot.size} respostas na collection 'responses'`);

    const responses = [];
    responsesSnapshot.forEach(doc => {
      const responseData = doc.data();
      console.log(`📝 Resposta encontrada:`, {
        id: doc.id,
        question_id: responseData.question_id,
        value: responseData.value,
        numeric_value: responseData.numeric_value,
        user_id: responseData.user_id
      });
      responses.push({
        id: doc.id,
        ...responseData,
        created_at: responseData.created_at?.toDate?.()?.toISOString() || responseData.created_at
      });
    });

    // Agrupar respostas por valor
    const responseStats = {};
    responses.forEach(response => {
      const value = response.value || response.numeric_value || 'N/A';
      console.log(`📊 Processando resposta com valor: "${value}"`);
      responseStats[value] = (responseStats[value] || 0) + 1;
    });

    console.log(`📊 Estatísticas agrupadas:`, responseStats);

    // Converter para array ordenado
    const statistics = Object.entries(responseStats).map(([value, count]) => ({
      response: value,
      count: count,
      percentage: responses.length > 0 ? Math.round((count / responses.length) * 100) : 0
    })).sort((a, b) => b.count - a.count);

    const result = {
      questionId,
      totalResponses: responses.length,
      statistics
    };

    console.log(`✅ Estatísticas finais geradas para questão ${questionId}:`, result);
    res.json(result);

  } catch (error) {
    console.error('❌ Erro ao gerar estatísticas da questão:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});


// Dashboard com estatísticas gerais
app.get('/api/statistics', authenticateToken, async (req, res) => {
  try {
    console.log('📊 Gerando estatísticas...');

    const stats = {};

    // Contar usuários
    const usersSnapshot = await db.collection('users').get();
    stats.totalUsers = usersSnapshot.size;

    // Contar questionários ativos
    const questionnairesSnapshot = await db.collection('questionnaires')
      .get();

    // Filtragem em memória para evitar necessidade de índices extras
    let activeQuests = 0;
    questionnairesSnapshot.forEach(doc => {
      const d = doc.data();
      const stat = d.status || (d.is_active === false ? 'finished' : 'active');
      if (stat === 'active') activeQuests++;
    });
    stats.totalQuestionnaires = activeQuests;

    // Contar questões
    const questionsSnapshot = await db.collection('questions').get();
    stats.totalQuestions = questionsSnapshot.size;

    // Contar respostas
    const responsesSnapshot = await db.collection('responses').get();
    stats.totalResponses = responsesSnapshot.size;

    // Estatísticas por questionário
    stats.questionnaireStats = [];

    for (const questionnaireDoc of questionnairesSnapshot.docs) {
      const questionnaireData = questionnaireDoc.data();

      // Contar questões deste questionário
      const questionsCount = await db.collection('questions')
        .where('questionnaire_id', '==', questionnaireDoc.id)
        .get();

      // Contar respostas deste questionário
      const questionIds = [];
      questionsCount.forEach(doc => questionIds.push(doc.id));

      let responsesCount = 0;
      if (questionIds.length > 0) {
        // Buscar respostas em lotes devido ao limite do Firestore
        const batchSize = 10;
        for (let i = 0; i < questionIds.length; i += batchSize) {
          const batch = questionIds.slice(i, i + batchSize);
          const responsesSnapshot = await db.collection('responses')
            .where('question_id', 'in', batch)
            .get();
          responsesCount += responsesSnapshot.size;
        }
      }

      stats.questionnaireStats.push({
        id: questionnaireDoc.id,
        title: questionnaireData.title,
        questionsCount: questionsCount.size,
        responsesCount
      });
    }

    console.log('✅ Estatísticas geradas');
    res.json(stats);

  } catch (error) {
    console.error('❌ Erro ao gerar estatísticas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// =========================================================
// NOVA ROTA: DADOS DO DASHBOARD (Adicione no final do arquivo)
// =========================================================

// Helper para extrair Ano, Mês e Dia no fuso horário de Brasília (UTC-3)
const getBrazilYMD = (timestamp) => {
  if (!timestamp) return { year: new Date().getFullYear(), month: new Date().getMonth(), day: new Date().getDate() };
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const str = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: 'numeric', day: 'numeric'
  }).format(date);
  const [month, day, year] = str.split('/');
  return {
    year: parseInt(year, 10),
    month: parseInt(month, 10) - 1, // 0-indexed para compatibilidade com Date.getMonth()
    day: parseInt(day, 10)
  };
};

// Endpoint para salvar a meta de engajamento
app.post('/api/settings/goal', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { goal } = req.body;
    if (goal === undefined) return res.status(400).json({ error: 'Meta é obrigatória' });

    console.log(`🎯 Atualizando meta de engajamento para: ${goal}%`);

    await db.collection('system_settings').doc('dashboard').set({
      engagement_goal: Number(goal),
      updated_at: FieldValue.serverTimestamp(),
      updated_by: req.user.id
    }, { merge: true });

    res.json({ success: true, message: 'Meta atualizada com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao salvar meta:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

app.get('/api/dashboard-data', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { year = new Date().getFullYear(), month, questionnaireId } = req.query;
    const targetYear = parseInt(year);
    const targetMonth = month !== undefined ? parseInt(month) : -1; // -1 significa "todos"

    console.log(`📊 Buscando dados para o Dashboard (${targetYear}, Mês: ${targetMonth}, Questionário: ${questionnaireId})...`);

    // 1. Contar Usuários (Filtrando Administradores e Inativos)
    const usersSnap = await db.collection('users').get();
    const filteredUsers = [];
    usersSnap.forEach(doc => {
      const data = doc.data();
      const role = (data.role || '').toLowerCase();
      if (role !== 'admin' && role !== 'administrator' && data.is_active !== false) {
        filteredUsers.push({ id: doc.id, ...data });
      }
    });
    const activeUserCount = filteredUsers.length;

    // 2. Buscar Questionários Ativos
    const questsSnap = await db.collection('questionnaires').get();
    const activeQuestionnaires = [];
    questsSnap.forEach(doc => {
      const data = doc.data();
      if (data.is_active !== false && data.status !== 'finished') {
        activeQuestionnaires.push({ id: doc.id, title: data.title });
      }
    });

    console.log(`🔍 DEBUG: Encontrados ${usersSnap.size} usuários totais, ${activeUserCount} colaboradores ativos.`);

    // 3. Buscar Sessões de Resposta e Aplicar Lotes
    const sessionsSnap = await db.collection('response_sessions').get();

    // Mapeamento de IDs e Usernames para garantir que encontremos o nome
    const userNamesMap = {};
    usersSnap.forEach(doc => {
      const uData = doc.data();
      userNamesMap[String(doc.id)] = uData.full_name;
    });

    const unfilteredSessionsForDetails = sessionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    let allSessions = sessionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const activeQuestionnaireIds = new Set(activeQuestionnaires.map(q => q.id));
    allSessions = allSessions.filter(s => activeQuestionnaireIds.has(s.questionnaire_id));

    if (questionnaireId && questionnaireId !== 'all') {
      allSessions = allSessions.filter(s => s.questionnaire_id === questionnaireId);
    }

    // BATCH SIZE = 5 para o Anonimato
    const totalUsersMap = {};
    activeQuestionnaires.forEach(q => {
      totalUsersMap[q.id] = activeUserCount;
    });

    const { releasedSessions, pendingSessionIds } = getReleasedSessions(allSessions, 5, totalUsersMap);

    const monthlyCounts = new Array(12).fill(0);
    const monthlyQuestionnaireCounts = new Array(12).fill(0);

    let dailyCounts = [];
    let dailyQuestionnaireCounts = [];
    if (targetMonth !== -1) {
      const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
      dailyCounts = new Array(daysInMonth).fill(0);
      dailyQuestionnaireCounts = new Array(daysInMonth).fill(0);
    }

    // Mapeamento de títulos de questionários
    const questionnaireTitles = {};
    questsSnap.forEach(doc => {
      questionnaireTitles[doc.id] = doc.data().title;
    });

    let realResponsesInPeriod = 0;
    const realMonthlyCounts = new Array(12).fill(0);
    let realDailyCounts = [];
    if (targetMonth !== -1) {
      const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
      realDailyCounts = new Array(daysInMonth).fill(0);
    }

    // 1. Cálculo Real (Para KPIs e Gráficos)
    allSessions.forEach(s => {
      if (s.created_at) {
        const { year: sYear, month: sMonth, day: sDay } = getBrazilYMD(s.created_at);
        if (sYear === targetYear) {
          realMonthlyCounts[sMonth]++;

          if (targetMonth === -1 || sMonth === targetMonth) {
            realResponsesInPeriod++;
            if (targetMonth !== -1) {
              realDailyCounts[sDay - 1]++;
            }
          }
        }
      }
    });

    // 2. Cálculo Filtrado (Para Carrossel/Identificação)
    let releasedPeriodSessionIds = new Set();
    let respondentDetails = []; // { name, questionnaire }
    let respondentMap = {}; // user_id -> set of questionnaire_ids responded

    releasedSessions.forEach(s => {
      const uid = s.user_id ? String(s.user_id) : null;
      if (uid) {
        if (!respondentMap[uid]) respondentMap[uid] = new Set();
        respondentMap[uid].add(s.questionnaire_id);
      }

      if (s.created_at) {
        const { year: sYear, month: sMonth } = getBrazilYMD(s.created_at);
        if (sYear === targetYear) {
          if (targetMonth === -1 || sMonth === targetMonth) {
            releasedPeriodSessionIds.add(s.id);

            let realName = userNamesMap[uid];
            if (!realName && s.respondent_name && s.respondent_name !== 'Anônimo' && s.respondent_name !== 'Colaborador Anônimo') {
              realName = s.respondent_name;
            }

            if (!realName || realName === 'Anônimo' || realName === 'Colaborador Anônimo') {
              realName = 'Participante';
            }

            respondentDetails.push({
              name: realName,
              questionnaire: questionnaireTitles[s.questionnaire_id] || 'Questionário Removido'
            });
          }
        }
      }
    });

    const activity = await calculateAverageScore(allSessions);

    // Contagem mensal de questionários criados
    questsSnap.forEach(doc => {
      const data = doc.data();
      if (data.created_at) {
        const { year: qYear, month: qMonth, day: qDay } = getBrazilYMD(data.created_at);
        if (qYear === targetYear) {
          monthlyQuestionnaireCounts[qMonth]++;

          if (targetMonth !== -1 && qMonth === targetMonth) {
            dailyQuestionnaireCounts[qDay - 1]++;
          }
        }
      }
    });

    // 4. Identificar Usuários Pendentes por Questionário
    const pendingDetails = [];
    usersSnap.forEach(doc => {
      const u = doc.data();
      const role = (u.role || '').toLowerCase();
      if (role !== 'admin' && role !== 'administrator' && u.is_active !== false) {
        const uid = String(doc.id);
        const userRespondedTo = respondentMap[uid] || new Set();

        activeQuestionnaires.forEach(q => {
          if (questionnaireId && questionnaireId !== 'all' && q.id !== questionnaireId) {
            return;
          }
          if (!userRespondedTo.has(q.id)) {
            pendingDetails.push({
              id: `${uid}_${q.id}`,
              full_name: u.full_name,
              username: u.username,
              questionnaire: q.title
            });
          }
        });
      }
    });

    // 5. Buscar Meta do Firestore
    const settingsSnap = await db.collection('system_settings').doc('dashboard').get();
    const globalEngagementGoal = settingsSnap.exists ? settingsSnap.data().engagement_goal : 80;

    let engagementGoal = globalEngagementGoal;
    if (questionnaireId && questionnaireId !== 'all') {
      const qDoc = questsSnap.docs.find(d => d.id === questionnaireId);
      if (qDoc && qDoc.data().engagement_goal !== undefined) {
        engagementGoal = Number(qDoc.data().engagement_goal);
      }
    }

    // Calcular dados individuais por questionário (usando sessões não filtradas)
    const questionnairesDetails = activeQuestionnaires.map(q => {
      const qDoc = questsSnap.docs.find(d => d.id === q.id);
      const qData = qDoc ? qDoc.data() : {};

      // Contar usuários únicos que responderam este questionário específico
      const uniqueRespondents = new Set(
        unfilteredSessionsForDetails
          .filter(s => s.questionnaire_id === q.id && s.user_id)
          .map(s => s.user_id)
      ).size;

      const rate = activeUserCount > 0
        ? parseFloat(((uniqueRespondents / activeUserCount) * 100).toFixed(1))
        : 0.0;

      const qGoal = qData.engagement_goal !== undefined
        ? Number(qData.engagement_goal)
        : Number(globalEngagementGoal);

      return {
        id: q.id,
        title: q.title,
        engagementRate: rate,
        engagementGoal: qGoal,
        responsesCount: uniqueRespondents
      };
    });

    const rateDivisor = activeUserCount * (questionnaireId && questionnaireId !== 'all' ? 1 : activeQuestionnaires.length);
    const engagementRate = rateDivisor > 0
      ? ((allSessions.length / rateDivisor) * 100).toFixed(1)
      : "0.0";

    const stats = {
      totalUsers: activeUserCount,
      totalQuestionnaires: questionnaireId && questionnaireId !== 'all' ? 1 : activeQuestionnaires.length,
      responses: realResponsesInPeriod,
      activity: activity,
      engagementRate: engagementRate,
      engagementGoal: engagementGoal, // Retornar a meta específica ou global
      questionnairesDetails: questionnairesDetails,
      monthlyCounts: realMonthlyCounts,
      monthlyQuestionnaireCounts: monthlyQuestionnaireCounts,
      dailyCounts: realDailyCounts,
      dailyQuestionnaireCounts: dailyQuestionnaireCounts,
      pendingUsers: pendingDetails,
      respondents: respondentDetails,
      batchSize: 5,
      realTotalResponses: allSessions.length,
      debugInfo: { usersInSnap: usersSnap.size }
    };

    console.log('✅ Dados do Dashboard consolidados:', stats);
    res.json(stats);

  } catch (error) {
    console.error('❌ Erro no Dashboard:', error);
    res.json({
      totalUsers: -1,
      errorMessage: error.message, totalQuestionnaires: 0,
      responses: 0,
      activity: "0.0",
      monthlyCounts: new Array(12).fill(0),
      monthlyQuestionnaireCounts: new Array(12).fill(0)
    });
  }
});

// VERSÃO PÚBLICA DO DASHBOARD (Sem autenticação)
app.get('/api/public/dashboard-data', async (req, res) => {
  try {
    const targetYear = new Date().getFullYear();
    const { questionnaireId } = req.query;

    const [usersSnap, questsSnap, sessionsSnap] = await Promise.all([
      db.collection('users').get(),
      db.collection('questionnaires').get(),
      db.collection('response_sessions').get()
    ]);

    // 1. Filtrar Usuários (Excluindo Administradores)
    const allUsersList = [];
    const userNamesMap = {};
    usersSnap.forEach(doc => {
      const uData = doc.data();
      const role = (uData.role || '').toLowerCase();
      if (role !== 'admin' && role !== 'administrator' && uData.is_active !== false) {
        const uid = String(doc.id);
        userNamesMap[uid] = uData.full_name;
        allUsersList.push({ id: uid, ...uData });
      }
    });
    const activeUserCount = allUsersList.length;

    // 2. Filtrar Questionários Ativos
    const activeQuestionnaires = [];
    questsSnap.forEach(doc => {
      const data = doc.data();
      if (data.is_active !== false && data.status !== 'finished') {
        activeQuestionnaires.push({ id: doc.id, title: data.title });
      }
    });

    const unfilteredSessionsForDetails = sessionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    let allSessions = sessionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const activeQuestionnaireIds = new Set(activeQuestionnaires.map(q => q.id));
    allSessions = allSessions.filter(s => activeQuestionnaireIds.has(s.questionnaire_id));

    if (questionnaireId && questionnaireId !== 'all') {
      allSessions = allSessions.filter(s => s.questionnaire_id === questionnaireId);
    }
    const questionnaireTitles = {};
    questsSnap.forEach(doc => {
      questionnaireTitles[doc.id] = doc.data().title;
    });

    // Aplicar Lotes (K-Anonymity) - BATCH SIZE = 5
    const totalUsersMap = {};
    activeQuestionnaires.forEach(q => {
      totalUsersMap[q.id] = activeUserCount;
    });

    const { releasedSessions } = getReleasedSessions(allSessions, 5, totalUsersMap);

    const monthlyCounts = new Array(12).fill(0);
    const monthlyQuestionnaireCounts = new Array(12).fill(0);
    let releasedRespondentNames = [];

    // 1. Contagem TOTAL para o Gráfico (Não viola anonimato)
    allSessions.forEach(s => {
      if (s.created_at) {
        const { year: sYear, month: sMonth } = getBrazilYMD(s.created_at);
        if (sYear === targetYear) {
          monthlyCounts[sMonth]++;
        }
      }
    });

    // 2. Dados FILTRADOS para o Carrossel (Anonimato garantido)
    releasedSessions.forEach(s => {
      if (s.created_at) {
        const { year: sYear } = getBrazilYMD(s.created_at);
        if (sYear === targetYear) {
          const uid = s.user_id ? String(s.user_id) : null;
          const realName = (uid && userNamesMap[uid]) || s.respondent_name || 'Participante';
          const qTitle = questionnaireTitles[s.questionnaire_id] || 'Pesquisa';

          releasedRespondentNames.push({
            name: realName,
            questionnaire: qTitle
          });
        }
      }
    });

    // 3. Questionários ATIVOS
    // 3. Contagem de Questionários por Período
    let activeQuestsCount = activeQuestionnaires.length;
    activeQuestionnaires.forEach(q => {
      const qDoc = questsSnap.docs.find(d => d.id === q.id);
      if (qDoc && qDoc.data().created_at) {
        const { year: qYear, month: qMonth } = getBrazilYMD(qDoc.data().created_at);
        if (qYear === targetYear) {
          monthlyQuestionnaireCounts[qMonth]++;
        }
      }
    });

    // Lógica de Pendências
    const pendingUsers = [];
    allUsersList.forEach(user => {
      const uid = user.id;
      const userResponses = allSessions.filter(s => String(s.user_id) === uid);
      const respondedQuests = new Set(userResponses.map(s => s.questionnaire_id));

      questsSnap.forEach(qDoc => {
        const qData = qDoc.data();
        if (qData.is_active !== false && qData.status !== 'finished' && !respondedQuests.has(qDoc.id)) {
          pendingUsers.push({
            full_name: user.full_name,
            questionnaire: qData.title
          });
        }
      });
    });

    // 5. Calcular Dados Diários para o Mês ATUAL (Para a TV)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const dailyCounts = new Array(daysInMonth).fill(0);
    const dailyQuestionnaireCounts = new Array(daysInMonth).fill(0);

    allSessions.forEach(s => {
      if (s.created_at) {
        const { year: sYear, month: sMonth, day: sDay } = getBrazilYMD(s.created_at);
        if (sYear === currentYear && sMonth === currentMonth) {
          dailyCounts[sDay - 1]++;
        }
      }
    });

    questsSnap.forEach(doc => {
      const data = doc.data();
      if (data.created_at) {
        const { year: qYear, month: qMonth, day: qDay } = getBrazilYMD(data.created_at);
        if (qYear === currentYear && qMonth === currentMonth) {
          dailyQuestionnaireCounts[qDay - 1]++;
        }
      }
    });

    // 5. Buscar Meta do Firestore
    const settingsSnap = await db.collection('system_settings').doc('dashboard').get();
    const globalEngagementGoal = settingsSnap.exists ? settingsSnap.data().engagement_goal : 80;

    let engagementGoal = globalEngagementGoal;
    if (questionnaireId && questionnaireId !== 'all') {
      const qDoc = questsSnap.docs.find(d => d.id === questionnaireId);
      if (qDoc && qDoc.data().engagement_goal !== undefined) {
        engagementGoal = Number(qDoc.data().engagement_goal);
      }
    }

    // Calcular dados individuais por questionário (usando sessões não filtradas)
    const questionnairesDetails = activeQuestionnaires.map(q => {
      const qDoc = questsSnap.docs.find(d => d.id === q.id);
      const qData = qDoc ? qDoc.data() : {};

      // Contar usuários únicos que responderam este questionário específico
      const uniqueRespondents = new Set(
        unfilteredSessionsForDetails
          .filter(s => s.questionnaire_id === q.id && s.user_id)
          .map(s => s.user_id)
      ).size;

      const rate = activeUserCount > 0
        ? parseFloat(((uniqueRespondents / activeUserCount) * 100).toFixed(1))
        : 0.0;

      const qGoal = qData.engagement_goal !== undefined
        ? Number(qData.engagement_goal)
        : Number(globalEngagementGoal);

      return {
        id: q.id,
        title: q.title,
        engagementRate: rate,
        engagementGoal: qGoal,
        responsesCount: uniqueRespondents
      };
    });

    const rateDivisor = activeUserCount * (questionnaireId && questionnaireId !== 'all' ? 1 : activeQuestionnaires.length);
    const engagementRate = rateDivisor > 0
      ? ((allSessions.length / rateDivisor) * 100).toFixed(1)
      : "0.0";

    res.json({
      totalUsers: activeUserCount,
      totalQuestionnaires: activeQuestsCount,
      responses: allSessions.length,
      engagementRate: engagementRate,
      engagementGoal: engagementGoal,
      questionnairesDetails: questionnairesDetails,
      activity: await calculateAverageScore(allSessions),
      monthlyCounts,
      monthlyQuestionnaireCounts,
      dailyCounts,
      dailyQuestionnaireCounts,
      respondents: releasedRespondentNames,
      pendingUsers,
      batchSize: 5
    });
  } catch (error) {
    console.error('❌ Erro no Dashboard Público:', error);
    res.json({
      totalUsers: -1,
      errorMessage: error.message,
      totalQuestionnaires: 0,
      responses: 0,
      engagementRate: "0.0",
      activity: "0.0",
      monthlyCounts: new Array(12).fill(0),
      monthlyQuestionnaireCounts: new Array(12).fill(0),
      respondents: [],
      pendingUsers: [],
      batchSize: 5
    });
  }
});

// === INICIALIZAÇÃO DO SERVIDOR ===
// Nota: Em Firebase Functions, a inicialização é tratada pelo export.api no final do arquivo.


// Tratamento de erros não capturados
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

// ==========================================
// ROTA DE INTELIGÊNCIA ARTIFICIAL (INSIGHTS) - GEMINI AI
// ==========================================

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Configure a chave da API do Gemini
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let genAI = null;
let geminiModel = null;

if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  // Usando gemini-flash-latest para melhor desempenho e compatibilidade em 2026
  geminiModel = genAI.getGenerativeModel({
    model: 'gemini-flash-latest'
  });
  console.log(`✅ Gemini AI configurado com sucesso! (Modelo: gemini-flash-latest)`);
} else {
  console.log('⚠️ GEMINI_API_KEY não configurada - usando análise estatística básica');
}

// Função auxiliar para extrair JSON de uma string que pode conter markdown ou texto extra
function extractJson(text) {
  try {
    // Tenta encontrar o primeiro { e o último }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      const jsonStr = text.substring(start, end + 1);
      return JSON.parse(jsonStr);
    }
    return JSON.parse(text);
  } catch (e) {
    console.error('❌ Erro ao extrair JSON do texto:', e.message);
    console.log('📄 Texto original:', text);
    throw new Error('Falha ao processar resposta da IA');
  }
}

// Função auxiliar para coletar dados completos do questionário
async function collectQuestionnaireData(questionnaireId) {
  // 1. Buscar questionário
  const qDoc = await db.collection('questionnaires').doc(questionnaireId).get();
  if (!qDoc.exists) {
    throw new Error('Questionário não encontrado');
  }
  const questionnaireData = qDoc.data();

  // 2. Buscar perguntas (embedded ou da coleção separada como fallback)
  let questions = questionnaireData.questions || [];

  if (questions.length === 0) {
    console.log(`🔍 Buscando questões na coleção separada para o questionário: ${questionnaireId}`);
    const questionsSnap = await db.collection('questions')
      .where('questionnaire_id', '==', questionnaireId)
      .get();

    questionsSnap.forEach(doc => {
      const qData = doc.data();
      questions.push({
        id: doc.id,
        text: qData.text,
        type: qData.type,
        options: qData.options || null,
        order: qData.order || qData.order_index || 0,
        is_required: qData.is_required !== false
      });
    });

    // Ordenar por ordem se necessário
    questions.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  // 2. Buscar todas as sessões de resposta deste questionário
  const sessionsSnap = await db.collection('response_sessions')
    .where('questionnaire_id', '==', questionnaireId)
    .get();

  const sessionIds = sessionsSnap.docs.map(doc => doc.id);
  const sessions = sessionsSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  // 3. Buscar todas as respostas dessas sessões
  let allResponses = [];
  if (sessionIds.length > 0) {
    // Firestore limita 'in' a 30 itens, então fazemos em chunks
    const chunks = [];
    for (let i = 0; i < sessionIds.length; i += 30) {
      chunks.push(sessionIds.slice(i, i + 30));
    }

    for (const chunk of chunks) {
      const responsesSnap = await db.collection('responses')
        .where('session_id', 'in', chunk)
        .get();

      responsesSnap.forEach(doc => {
        allResponses.push({
          id: doc.id,
          ...doc.data()
        });
      });
    }
  }

  return {
    questionnaire: questionnaireData,
    questions: questionnaireData.questions || [],
    sessions,
    responses: allResponses,
    totalRespondents: sessions.length
  };
}

// Função para preparar dados para análise
function prepareDataForAnalysis(data) {
  const { questionnaire, questions, responses, totalRespondents } = data;

  // Organizar respostas por pergunta
  const responsesByQuestion = {};
  questions.forEach(q => {
    responsesByQuestion[q.id] = {
      questionText: q.text,
      questionType: q.type,
      options: q.options || [],
      responses: []
    };
  });

  responses.forEach(r => {
    if (responsesByQuestion[r.question_id]) {
      responsesByQuestion[r.question_id].responses.push({
        value: r.value,
        numericValue: r.numeric_value
      });
    }
  });

  // Calcular estatísticas por pergunta
  const questionStats = [];
  for (const [qId, qData] of Object.entries(responsesByQuestion)) {
    const stats = {
      id: qId,
      text: qData.questionText,
      type: qData.questionType,
      totalResponses: qData.responses.length,
      responses: qData.responses
    };

    // Estatísticas numéricas
    const numericResponses = qData.responses.filter(r => r.numericValue !== null && r.numericValue !== undefined);
    if (numericResponses.length > 0) {
      const values = numericResponses.map(r => r.numericValue);
      stats.average = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
      stats.min = Math.min(...values);
      stats.max = Math.max(...values);
      stats.distribution = {};
      values.forEach(v => {
        stats.distribution[v] = (stats.distribution[v] || 0) + 1;
      });
    }

    // Contagem de respostas textuais
    if (qData.type === 'multiple_choice' || qData.type === 'single_choice') {
      stats.optionCounts = {};
      qData.responses.forEach(r => {
        const val = r.value;
        stats.optionCounts[val] = (stats.optionCounts[val] || 0) + 1;
      });
    }

    // Respostas de texto livre
    if (qData.type === 'text' || qData.type === 'long_text') {
      stats.textResponses = qData.responses.map(r => r.value).filter(v => v && v.trim());
    }

    questionStats.push(stats);
  }

  return {
    questionnaireTitle: questionnaire.title,
    questionnaireDescription: questionnaire.description,
    totalRespondents,
    totalResponses: responses.length,
    questionStats
  };
}

// Função para gerar prompt para o Gemini
function generateGeminiPrompt(analysisData) {
  const { questionnaireTitle, questionnaireDescription, totalRespondents, questionStats } = analysisData;

  let prompt = `Você é um analista de dados especializado em pesquisas de saúde e bem-estar. Analise os seguintes dados de um questionário e forneça insights detalhados e acionáveis.

## QUESTIONÁRIO: "${questionnaireTitle}"
${questionnaireDescription ? `Descrição: ${questionnaireDescription}` : ''}

## DADOS COLETADOS
- Total de respondentes: ${totalRespondents}

## RESPOSTAS POR PERGUNTA:

`;

  questionStats.forEach((q, index) => {
    prompt += `### Pergunta ${index + 1}: "${q.text}" (Tipo: ${q.type})
- Total de respostas: ${q.totalResponses}
`;

    if (q.average) {
      prompt += `- Média: ${q.average} (Min: ${q.min}, Max: ${q.max})
- Distribuição: ${JSON.stringify(q.distribution)}
`;
    }

    if (q.optionCounts) {
      prompt += `- Distribuição das respostas: ${JSON.stringify(q.optionCounts)}
`;
    }

    if (q.textResponses && q.textResponses.length > 0) {
      prompt += `- Respostas textuais (amostra de até 10):
${q.textResponses.slice(0, 10).map(t => `  • "${t}"`).join('\n')}
`;
    }

    prompt += '\n';
  });

  prompt += `
## INSTRUÇÕES PARA ANÁLISE

Forneça uma análise completa em formato JSON com a seguinte estrutura EXATA:

{
  "resumo_executivo": "Um parágrafo resumindo os principais achados",
  "pontos_fortes": [
    "Lista de 3-5 pontos positivos identificados nos dados"
  ],
  "pontos_atencao": [
    "Lista de 3-5 áreas que precisam de atenção ou melhoria"
  ],
  "insights_detalhados": [
    {
      "titulo": "Título do insight",
      "descricao": "Descrição detalhada do insight",
      "impacto": "alto|medio|baixo",
      "recomendacao": "Ação recomendada"
    }
  ],
  "plano_acao": [
    {
      "prioridade": 1,
      "acao": "Descrição da ação",
      "prazo_sugerido": "imediato|curto_prazo|medio_prazo|longo_prazo",
      "justificativa": "Por que essa ação é importante"
    }
  ],
  "metricas_chave": {
    "feedback_positivo": "XX%",
    "nivel_engajamento": "alto|medio|baixo",
    "principais_preocupacoes": ["lista de preocupações"]
  },
  "tendencias": [
    "Observações sobre padrões ou tendências nos dados"
  ]
}

IMPORTANTE:
1. Base suas conclusões APENAS nos dados fornecidos
2. Seja específico e cite números quando possível
3. Foque em insights acionáveis para um programa de saúde
4. Retorne APENAS o JSON, sem texto adicional
5. Use português brasileiro`;

  return prompt;
}

// Rota principal de geração de insights
app.post('/api/generate-insights', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { questionnaireId } = req.body;
    console.log(`🧠 Gerando insights para o questionário: ${questionnaireId}`);

    // 1. Coletar todos os dados necessários
    const rawData = await collectQuestionnaireData(questionnaireId);

    // Verificar se há dados suficientes
    if (rawData.totalRespondents === 0 || rawData.questions.length === 0) {
      const reason = rawData.totalRespondents === 0 ? "Ainda não há respostas registradas." : "O questionário não possui perguntas configuradas.";
      return res.json({
        success: true,
        analysis: {
          strengths: ["Questionário identificado."],
          improvements: [reason],
          action_plan: ["Coletar mais respostas."]
        },
        detailed: null,
        message: "Dados insuficientes"
      });
    }

    // 2. Preparar dados para análise
    const analysisData = prepareDataForAnalysis(rawData);
    console.log(`📊 Dados preparados: ${analysisData.totalRespondents} respondentes, ${analysisData.questionStats.length} perguntas`);

    // 3. Verificar se Gemini está disponível
    if (geminiModel && GEMINI_API_KEY) {
      console.log('🤖 Solicitando análise ao Gemini AI...');

      try {
        const prompt = generateGeminiPrompt(analysisData);
        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        const aiText = response.text();

        console.log('🤖 Resposta bruta recebida do Gemini (comprimento):', aiText.length);

        const aiAnalysis = extractJson(aiText);

        console.log('✅ Análise do Gemini processada com sucesso!');

        // Converter para formato compatível com frontend existente + dados extras
        const analysis = {
          strengths: aiAnalysis.pontos_fortes || aiAnalysis.strengths || [],
          improvements: aiAnalysis.pontos_atencao || aiAnalysis.improvements || [],
          action_plan: (aiAnalysis.plano_acao || aiAnalysis.action_plan)?.map(a =>
            `[${(a.prazo_sugerido || a.priority || 'N/A').toUpperCase()}] ${a.acao || a.action || a}`
          ) || []
        };

        return res.json({
          success: true,
          analysis,
          detailed: aiAnalysis,
          source: 'gemini-ai',
          stats: {
            totalRespondents: analysisData.totalRespondents,
            totalResponses: analysisData.totalResponses,
            positiveRate: aiAnalysis.metricas_chave?.feedback_positivo || 'N/A'
          }
        });

      } catch (aiError) {
        console.error('⚠️ Erro crítico no Gemini AI:', aiError.message);
        console.error('📚 Stack:', aiError.stack);
        // Armazenar o erro para informar o usuário no fallback
        var aiErrorMessage = aiError.message;
        // Continua para análise estatística básica como fallback
      }
    }

    // 4. Fallback: Análise estatística básica (sem IA)
    console.log('📈 Usando análise estatística básica...');

    const analysis = {
      strengths: [],
      improvements: [],
      action_plan: []
    };

    let totalScore = 0;
    let countRating = 0;
    let textResponses = [];

    analysisData.questionStats.forEach(q => {
      if (q.average) {
        totalScore += parseFloat(q.average) * q.totalResponses;
        countRating += q.totalResponses;

        const is10Scale = q.type === 'rating_10';
        const highThreshold = is10Scale ? 8 : 4;
        const lowThreshold = is10Scale ? 6 : 3;

        if (parseFloat(q.average) >= highThreshold) {
          analysis.strengths.push(`"${q.text.substring(0, 50)}..." - Média alta: ${q.average}/${is10Scale ? 10 : 5}`);
        } else if (parseFloat(q.average) < lowThreshold) {
          analysis.improvements.push(`"${q.text.substring(0, 50)}..." - Média baixa: ${q.average}/${is10Scale ? 10 : 5}`);
        }
      }

      if (q.textResponses) {
        textResponses = textResponses.concat(q.textResponses);
      }
    });

    const overallAverage = countRating > 0 ? (totalScore / countRating).toFixed(1) : 0;

    // Análise de sentimento básica
    const negativeWords = ['ruim', 'péssimo', 'horrível', 'demora', 'demorado', 'não', 'nunca', 'insatisfeito', 'problema', 'difícil'];
    const positiveWords = ['bom', 'ótimo', 'excelente', 'rápido', 'fácil', 'satisfeito', 'gostei', 'recomendo'];

    let negativeCount = 0;
    let positiveCount = 0;

    textResponses.forEach(text => {
      const lowerText = text.toLowerCase();
      negativeWords.forEach(word => {
        if (lowerText.includes(word)) negativeCount++;
      });
      positiveWords.forEach(word => {
        if (lowerText.includes(word)) positiveCount++;
      });
    });

    // Nota: overallAverage aqui é uma média ponderada. Se houver mistura de escalas (5 e 10), 
    // a interpretação simplista abaixo pode ser imprecisa, mas serve como fallback.
    const isMainly10Scale = analysisData.questionStats.some(q => q.type === 'rating_10' && q.totalResponses > 0);
    const highOverall = isMainly10Scale ? 8 : 4;
    const lowOverall = isMainly10Scale ? 6 : 3;
    const maxScale = isMainly10Scale ? 10 : 5;

    if (overallAverage >= highOverall) {
      analysis.strengths.push(`Satisfação geral alta (média ${overallAverage}/${maxScale})`);
    } else if (overallAverage >= lowOverall) {
      analysis.improvements.push(`Satisfação moderada (média ${overallAverage}/${maxScale}) - há espaço para melhorias`);
    } else if (overallAverage > 0) {
      analysis.improvements.push(`Satisfação baixa (média ${overallAverage}/${maxScale}) - requer atenção imediata`);
    }

    if (positiveCount > negativeCount) {
      analysis.strengths.push(`Feedback textual majoritariamente positivo (${positiveCount} menções positivas)`);
    } else if (negativeCount > positiveCount) {
      analysis.improvements.push(`Detectados ${negativeCount} comentários com termos negativos`);
      analysis.action_plan.push("Revisar comentários de texto para identificar problemas específicos");
    }

    if (typeof aiErrorMessage !== 'undefined' && aiErrorMessage) {
      analysis.improvements.push(`ERRO DA IA: ${aiErrorMessage}`);
      analysis.action_plan.push("Verifique se a sua GEMINI_API_KEY é válida e tem permissão para o modelo gemini-flash-latest.");
    }

    analysis.strengths.push(`${analysisData.totalRespondents} pessoas responderam ao questionário`);

    // Plano de ação básico
    if (analysis.improvements.length > 0) {
      analysis.action_plan.push("Investigar as áreas com menor avaliação");
      analysis.action_plan.push("Realizar entrevistas qualitativas para entender os problemas");
    }
    analysis.action_plan.push("Continuar coletando feedback regularmente");

    // Garantir que sempre haja algo
    if (analysis.strengths.length === 0) {
      analysis.strengths.push("Dados sendo coletados para análise mais precisa");
    }
    if (analysis.action_plan.length === 0) {
      analysis.action_plan.push("Aguardar mais respostas para recomendações específicas");
    }

    console.log('✅ Análise estatística concluída');

    const totalSentiment = positiveCount + negativeCount;
    const positiveRate = totalSentiment > 0 ? Math.round((positiveCount / totalSentiment) * 100) + '%' : 'N/A';

    res.json({
      success: true,
      analysis,
      detailed: null,
      source: 'statistical-analysis',
      aiError: typeof aiErrorMessage !== 'undefined' ? aiErrorMessage : null,
      message: typeof aiErrorMessage !== 'undefined' ? `Aviso: A IA falhou (${aiErrorMessage}). Usando fallback.` : "Sucesso",
      stats: {
        totalRespondents: analysisData.totalRespondents,
        totalResponses: analysisData.totalResponses,
        positiveRate
      }
    });

  } catch (error) {
    console.error('❌ Erro ao gerar insights:', error);
    res.status(500).json({ error: 'Erro ao gerar insights', details: error.message });
  }
});

// Exportar a API para o Firebase Functions
const functions = require('firebase-functions');
const expressApp = require('express')();
expressApp.use((req, res, next) => {
  // Limpeza de barras duplas e prefixos repetidos para evitar erros 404
  let cleanUrl = req.url.replace(/\/+/g, '/');

  // Se a rota começar com /api/api, remove um dos /api
  if (cleanUrl.startsWith('/api/api')) {
    cleanUrl = cleanUrl.replace('/api/api', '/api');
  }

  // Se não começar com /api, garante a inclusão do prefixo
  if (!cleanUrl.startsWith('/api')) {
    cleanUrl = '/api' + (cleanUrl === '/' ? '' : cleanUrl);
  }

  req.url = cleanUrl;
  app(req, res, next);
});
exports.api = functions.https.onRequest(expressApp);