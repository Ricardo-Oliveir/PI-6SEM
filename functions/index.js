// API Backend para o aplicativo VivaMais usando Firebase Firestore
// Este é um exemplo completo de como criar a API que o app React Native irá consumir

// Dependências necessárias:
// npm install express firebase-admin cors helmet bcryptjs jsonwebtoken dotenv

const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

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

// Middleware - CORS configurado para React Native
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sem origin (mobile apps, postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'https://projeto-vivamais-2026.web.app',
      'http://localhost:3000',
      'http://localhost:3001', //pagina web
      'http://localhost:8081',
      'http://localhost:19006', 
      'http://10.125.129.8:8081',
      'http://172.20.10.4:8081',  // SEU IP REAL
      'http://172.20.10.4:19006', // SEU IP REAL
      'exp://172.20.10.4:19000',  // SEU IP REAL
      'exp://localhost:19000',
      'http://10.0.3.28:8081',      // IP antigo (backup)
      'http://10.0.3.28:19006',     // IP antigo (backup)  
      'exp://10.0.3.28:19000'       // IP antigo (backup)
    ];
    
    console.log(`🌐 CORS check - Origin: ${origin}`);
    
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      console.log(`❌ CORS bloqueado para origin: ${origin}`);
      callback(null, true); // Permitindo por enquanto para debug
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

// Middleware de logging para debug
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path} - Origin: ${req.get('Origin')} - IP: ${req.ip}`);
  console.log(`📋 Headers:`, req.headers);
  next();
});

// Middleware para verificar JWT
const authenticateToken = (req, res, next) => {
  console.log('🔐 === MIDDLEWARE DE AUTENTICAÇÃO ===');
  
  // Log de todos os nomes de headers recebidos para detectar se o Authorization está sendo renomeado
  console.log('📋 Headers recebidos:', Object.keys(req.headers).join(', '));
  
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  console.log('🔐 Authorization header:', authHeader ? 'Presente' : 'Ausente');
  
  if (authHeader) {
    console.log('🔐 Conteúdo do header (truncated):', authHeader.substring(0, 30));
  }

  const token = authHeader && authHeader.split(' ')[1];
  console.log('🔐 Token extraído:', token ? `${token.substring(0, 20)}...` : 'Nenhum');

  if (!token) {
    console.log('❌ Nenhum token fornecido');
    return res.status(401).json({ error: 'Token de acesso requerido' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'vivamais-secret-key', (err, user) => {
    if (err) {
      console.log('❌ Erro na verificação do JWT:', err.message);
      console.log('🔐 Token completo:', token);
      console.log('🔐 JWT_SECRET usado:', process.env.JWT_SECRET || 'vivamais-secret-key');
      return res.status(403).json({ error: 'Token inválido', details: err.message });
    }
    
    console.log('✅ Token válido! Usuário:', user.username, 'ID:', user.id);
    req.user = user;
    next();
  });
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

// Initialize Database - Endpoint para criar estruturas no Firestore
app.post('/api/init-database', async (req, res) => {
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
        email: 'admin@vivamais.com',
        password_hash,
        role: 'admin',
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
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
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        is_active: true
      });
      
      // Perguntas para o questionário 1
      const questions1 = [
        {
          text: 'Como você avalia o atendimento que recebeu?',
          type: 'rating',
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
          created_at: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      // Questionário 2
      const questionnaire2Ref = await db.collection('questionnaires').add({
        title: 'Avaliação de Acessibilidade',
        description: 'Como podemos melhorar a acessibilidade dos nossos serviços?',
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        is_active: true
      });
      
      // Perguntas para o questionário 2
      const questions2 = [
        {
          text: 'Como você avalia a facilidade de acesso ao nosso local?',
          type: 'rating',
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
          created_at: admin.firestore.FieldValue.serverTimestamp()
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

// Debug endpoint - Listar todas as questões
app.get('/api/debug/questions', async (req, res) => {
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

// Migração para estrutura embedded - ENDPOINT TEMPORÁRIO
app.post('/api/migrate-to-embedded', async (req, res) => {
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
        updated_at: admin.firestore.FieldValue.serverTimestamp()
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

// Network Test - Para debug React Native
app.get('/api/network-test', (req, res) => {
  res.json({
    message: '✅ Conexão entre React Native e servidor funcionando!',
    timestamp: new Date().toISOString(),
    clientIP: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    origin: req.get('Origin'),
    headers: {
      'content-type': req.get('Content-Type'),
      'authorization': req.get('Authorization') ? 'Present' : 'Not present'
    }
  });
});

// Teste do banco - Para verificar se o Firestore está funcionando
app.get('/api/database-test', async (req, res) => {
  try {
    console.log('🧪 Testando Firestore...');
    
    const tests = {};

    // Teste 1: Verificar coleções
    const collections = ['users', 'questionnaires', 'questions', 'responses'];
    tests.collections = {};
    
    for (const collectionName of collections) {
      try {
        const snapshot = await db.collection(collectionName).limit(1).get();
        tests.collections[collectionName] = {
          exists: true,
          documentCount: snapshot.size
        };
      } catch (err) {
        tests.collections[collectionName] = {
          exists: false,
          error: err.message
        };
      }
    }

    // Teste 2: Verificar usuário admin
    try {
      const adminSnapshot = await db.collection('users')
        .where('username', '==', 'admin')
        .limit(1)
        .get();
      
      if (!adminSnapshot.empty) {
        const adminDoc = adminSnapshot.docs[0];
        tests.adminUser = {
          id: adminDoc.id,
          ...adminDoc.data(),
          password_hash: '[HIDDEN]' // Não expor o hash da senha
        };
      } else {
        tests.adminUser = null;
      }
    } catch (err) {
      tests.adminUser = { error: err.message };
    }

    // Teste 3: Contar documentos em cada coleção
    tests.counts = {};
    for (const collectionName of collections) {
      try {
        const snapshot = await db.collection(collectionName).get();
        tests.counts[collectionName] = snapshot.size;
      } catch (err) {
        tests.counts[collectionName] = `Error: ${err.message}`;
      }
    }

    res.json({
      success: true,
      message: 'Testes do Firebase Firestore executados com sucesso',
      tests,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro nos testes do banco:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao executar testes do banco',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// === ROTAS DE AUTENTICAÇÃO ===

// Login
app.get('/api/auth/biometric-data', async (req, res) => {
  try {
    const snapshot = await db.collection('users').where('is_active', '==', true).get();
    const users = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.face_descriptor) {
        users.push({
          id: doc.id,
          username: data.username,
          face_descriptor: data.face_descriptor,
          role: data.role
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
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID requerido' });

    console.log(`👤 Gerando token biométrico para: ${userId}`);

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'Usuário não encontrado' });

    const userData = userDoc.data();
    
    // Gerar JWT real
    const token = jwt.sign(
      { id: userDoc.id, username: userData.username, role: userData.role || 'user' },
      process.env.JWT_SECRET || 'vivamais-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: userDoc.id,
        username: userData.username,
        full_name: userData.full_name,
        email: userData.email, // Incluído email para paridade
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

    console.log(`🔑 Tentativa de login para: ${username}`);

    // Buscar usuário no Firestore
    const userSnapshot = await db.collection('users')
      .where('username', '==', username)
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
      process.env.JWT_SECRET || 'vivamais-secret-key',
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
    const { username, full_name, email, password, role = 'user', face_photo, face_descriptor } = req.body;

    // Validações
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email e password são obrigatórios' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password deve ter pelo menos 6 caracteres' });
    }

    console.log(`📝 Tentativa de registro para: ${username}`);

    // Verificar se username já existe
    const usernameSnapshot = await db.collection('users')
      .where('username', '==', username)
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

    // Verificar se FULL NAME já existe (Evitar duplicidade de pessoas)
    const nameSnapshot = await db.collection('users')
      .where('full_name', '==', full_name)
      .limit(1)
      .get();

    if (!nameSnapshot.empty) {
      return res.status(400).json({ error: 'Este nome já está cadastrado no sistema.' });
    }

    // Hash da senha
    const password_hash = await bcrypt.hash(password, 12);

    // Criar usuário no Firestore
    const newUser = {
      username,
      full_name: full_name || username,
      email,
      password_hash,
      role,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
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
app.get('/api/users', authenticateToken, async (req, res) => {
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
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
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
app.put('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, email, phone, address, role, username, face_photo, face_descriptor } = req.body;
    
    console.log(`✏️ Atualizando usuário ID: ${id}`);
    
    // Verifica se usuário existe
    const docRef = db.collection('users').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    // Preparar objeto de update com os campos que vieram no body
    const updates = {
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };
    
    if (full_name !== undefined) updates.full_name = full_name;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (address !== undefined) updates.address = address;
    if (role !== undefined) updates.role = role;
    if (username !== undefined) updates.username = username;
    if (face_photo !== undefined) updates.face_photo = face_photo;
    if (face_descriptor !== undefined) updates.face_descriptor = face_descriptor;
    
    await docRef.update(updates);
    
    console.log(`✅ Usuário atualizado com sucesso: ${id}`);
    res.json({ success: true, message: 'Usuário atualizado com sucesso' });
    
  } catch (error) {
    console.error('❌ Erro ao atualizar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// === ROTAS DE QUESTIONÁRIOS ===

// Listar todos os questionários
app.get('/api/questionnaires', authenticateToken, async (req, res) => {
  try {
    console.log('📋 Buscando questionários...');
    
    // Consulta simples sem índice - buscar todos para o admin
    const snapshot = await db.collection('questionnaires').get();

    const questionnaires = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      
      // Adm vê todos os status (draft, active, finished)
      questionnaires.push({
        id: doc.id,
        ...data,
        status: data.status || (data.is_active === false ? 'finished' : 'active'),
        created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at,
        updated_at: data.updated_at?.toDate?.()?.toISOString() || data.updated_at
      });
    });

    // Ordenar por data de criação (mais recente primeiro)
    questionnaires.sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB - dateA;
    });

    console.log(`✅ ${questionnaires.length} questionários encontrados`);
    res.json(questionnaires);

  } catch (error) {
    console.error('❌ Erro ao buscar questionários:', error);
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
app.post('/api/questionnaires', authenticateToken, async (req, res) => {
  try {
    const { title, description, questions = [] } = req.body;
    
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
      created_by: req.user.id,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
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
app.patch('/api/questionnaires/:id/status', authenticateToken, async (req, res) => {
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
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('questionnaires').doc(id).update(updates);

    res.json({ success: true, message: `Status atualizado para ${status}` });
  } catch (error) {
    console.error('❌ Erro PATCH status:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Atualizar questionário
app.put('/api/questionnaires/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Título é obrigatório' });
    }

    console.log(`✏️ Atualizando questionário: ${id}`);

    const updates = {
      title,
      description: description || '',
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };

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

// Deletar questionário (soft delete)
app.delete('/api/questionnaires/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🗑️ Deletando questionário: ${id}`);

    await db.collection('questionnaires').doc(id).update({
      status: 'finished', // Deletar agora move para concluído/arquivado
      is_active: false,   // Legado funcional
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Questionário deletado: ${id}`);
    
    res.json({
      success: true,
      message: 'Questionário deletado com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao deletar questionário:', error);
    if (error.code === 'not-found') {
      res.status(404).json({ error: 'Questionário não encontrado' });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
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
app.post('/api/questionnaires/:id/questions', authenticateToken, async (req, res) => {
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
      updated_at: admin.firestore.FieldValue.serverTimestamp()
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
app.put('/api/questionnaires/:questionnaireId/questions/:questionId', authenticateToken, async (req, res) => {
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
      updated_at: admin.firestore.FieldValue.serverTimestamp()
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
app.delete('/api/questionnaires/:questionnaireId/questions/:questionId', authenticateToken, async (req, res) => {
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
      updated_at: admin.firestore.FieldValue.serverTimestamp()
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
      created_at: admin.firestore.FieldValue.serverTimestamp(),
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
      created_at: admin.firestore.FieldValue.serverTimestamp()
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
        created_at: admin.firestore.FieldValue.serverTimestamp()
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
    const questionIds = (qData.questions || []).map(q => q.id);

    if (questionIds.length === 0) {
      return res.json([]);
    }

    // Buscar respostas para essas questões
    const responses = [];
    
    // Firestore tem limite de 10 itens em consultas 'in', então fazemos em lotes
    const batchSize = 10;
    for (let i = 0; i < questionIds.length; i += batchSize) {
      const batch = questionIds.slice(i, i + batchSize);
      
      const snapshot = await db.collection('responses')
        .where('question_id', 'in', batch)
        .get();

      snapshot.forEach(doc => {
        const data = doc.data();
        responses.push({
          id: doc.id,
          ...data,
          created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at
        });
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
    
    // Contar respostas para este questionário
    // Como as questões agora são embedded, precisamos buscar respostas por question_id
    let totalResponses = 0;
    const questionStats = [];
    
    for (const question of questions) {
      const responsesSnapshot = await db.collection('responses')
        .where('question_id', '==', question.id)
        .get();
      
      const questionResponseCount = responsesSnapshot.size;
      totalResponses += questionResponseCount;
      
      questionStats.push({
        questionId: question.id,
        questionText: question.text,
        type: question.type,
        responses: questionResponseCount
      });
    }

    const statistics = {
      questionnaireId: id,
      title: questionnaireData.title,
      totalQuestions: questions.length,
      totalResponses,
      averageResponsesPerQuestion: questions.length > 0 ? Math.round(totalResponses / questions.length) : 0,
      completionRate: questions.length > 0 ? Math.round((totalResponses / questions.length) * 100) : 0,
      questionStats
    };

    console.log(`✅ Estatísticas geradas para questionário ${id}`);
    res.json(statistics);

  } catch (error) {
    console.error('❌ Erro ao gerar estatísticas do questionário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.get('/api/statistics', authenticateToken, async (req, res) => {
  try {
    console.log('📊 Calculando estatísticas...');
    
    // Conta documentos nas coleções
    const usersSnap = await db.collection('users').get();
    const questsSnap = await db.collection('questionnaires').get();
    
    // Para respostas, precisamos contar todas (pode ser pesado se tiver milhares, mas serve por agora)
    // Se você tiver uma coleção 'responses' separada:
    const respSnap = await db.collection('responses').get();
    // OU se as respostas ficam dentro de sessões, conte as sessões:
    // const respSnap = await db.collection('response_sessions').get(); 

    // Filtra questionários ativos
    let activeQuests = 0;
    questsSnap.forEach(doc => {
        const d = doc.data();
        const stat = d.status || (d.is_active === false ? 'finished' : 'active');
        if (stat === 'active') activeQuests++;
    });

    const stats = {
      totalUsers: usersSnap.size,
      totalQuestionnaires: activeQuests,
      totalResponses: respSnap.size // Ou 0 se não tiver respostas ainda
    };

    console.log('✅ Estatísticas:', stats);
    res.json(stats);

  } catch (error) {
    console.error('❌ Erro stats:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
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

// Debug: Listar todas as respostas (apenas para desenvolvimento)
app.get('/api/debug/responses', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 DEBUG: Listando todas as respostas no banco...');
    
    const responsesSnapshot = await db.collection('responses').get();
    console.log(`🔍 Total de documentos na collection 'responses': ${responsesSnapshot.size}`);
    
    const responses = [];
    responsesSnapshot.forEach(doc => {
      const data = doc.data();
      responses.push({
        id: doc.id,
        question_id: data.question_id,
        user_id: data.user_id,
        value: data.value,
        numeric_value: data.numeric_value,
        session_id: data.session_id,
        created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at
      });
    });
    
    console.log('🔍 Respostas encontradas:', responses.length);
    responses.forEach((resp, index) => {
      console.log(`🔍 Resposta ${index + 1}:`, resp);
    });
    
    res.json({
      total: responses.length,
      responses: responses
    });
    
  } catch (error) {
    console.error('❌ Erro no debug das respostas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Debug: Listar todas as sessões (apenas para desenvolvimento)
app.get('/api/debug/sessions', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 DEBUG: Listando todas as sessões no banco...');
    
    const sessionsSnapshot = await db.collection('response_sessions').get();
    console.log(`🔍 Total de documentos na collection 'response_sessions': ${sessionsSnapshot.size}`);
    
    const sessions = [];
    sessionsSnapshot.forEach(doc => {
      const data = doc.data();
      sessions.push({
        id: doc.id,
        questionnaire_id: data.questionnaire_id,
        user_id: data.user_id,
        respondent_name: data.respondent_name,
        respondent_age: data.respondent_age,
        created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at,
        completed_at: data.completed_at?.toDate?.()?.toISOString() || data.completed_at
      });
    });
    
    console.log('🔍 Sessões encontradas:', sessions.length);
    sessions.forEach((session, index) => {
      console.log(`🔍 Sessão ${index + 1}:`, session);
    });
    
    res.json({
      total: sessions.length,
      sessions: sessions
    });
    
  } catch (error) {
    console.error('❌ Erro no debug das sessões:', error);
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
    stats.totalQuestionnaires = questionnairesSnapshot.size;

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

app.get('/api/dashboard-data', authenticateToken, async (req, res) => {
  try {
    const { year = new Date().getFullYear(), month } = req.query;
    const targetYear = parseInt(year);
    const targetMonth = month !== undefined ? parseInt(month) : -1; // -1 significa "todos"
    
    console.log(`📊 Buscando dados para o Dashboard (${targetYear}, Mês: ${targetMonth})...`);
    
    // 1. Contar Usuários e Questionários
    const [usersSnap, questsSnap] = await Promise.all([
        db.collection('users').get(),
        db.collection('questionnaires').get()
    ]);
    
    let activeQuests = 0;
    questsSnap.forEach(doc => {
        const data = doc.data();
        if (data.is_active !== false && data.status !== 'finished') activeQuests++;
    });

    // 2. Buscar Sessões de Resposta e Filtrar
    const monthlyCounts = new Array(12).fill(0);
    const sessionsSnap = await db.collection('response_sessions').get();
    let responsesInPeriod = 0;
    let filteredSessionIds = new Set();

    sessionsSnap.forEach(doc => {
        const data = doc.data();
        if (data.created_at) {
            const date = data.created_at.toDate();
            if (date.getFullYear() === targetYear) {
                const sMonth = date.getMonth();
                monthlyCounts[sMonth]++;

                // Filtro para o total e para as respostas detalhadas
                if (targetMonth === -1 || sMonth === targetMonth) {
                    responsesInPeriod++;
                    filteredSessionIds.add(doc.id);
                }
            }
        }
    });

    // 3. Calcular Média de Atividade Filtrada por Período
    let totalScore = 0;
    let scoreCount = 0;
    const responsesSnap = await db.collection('responses').get();
    
    responsesSnap.forEach(doc => {
        const data = doc.data();
        const sessionId = data.session_id;
        
        // Se estamos filtrando por período, só contamos respostas de sessões que passaram no filtro
        if (filteredSessionIds.has(sessionId)) {
            if (data.numeric_value !== null && data.numeric_value !== undefined) {
                totalScore += Number(data.numeric_value);
                scoreCount++;
            }
        }
    });

    const activity = scoreCount > 0 ? (totalScore / scoreCount).toFixed(1) : "0.0";

    const stats = {
      totalUsers: usersSnap.size,
      totalQuestionnaires: activeQuests,
      responses: responsesInPeriod,
      activity: activity,
      monthlyCounts: monthlyCounts
    };

    console.log('✅ Dados do Dashboard consolidados:', stats);
    res.json(stats);

  } catch (error) {
    console.error('❌ Erro no Dashboard:', error);
    res.json({ 
        totalUsers: 0, 
        totalQuestionnaires: 0, 
        responses: 0, 
        activity: "0.0", 
        monthlyCounts: new Array(12).fill(0) 
    });
  }
});

// === INICIALIZAÇÃO DO SERVIDOR ===

// Função para inicializar estruturas do banco
async function initializeDatabaseStructures() {
  try {
    console.log('🔧 Verificando estruturas do banco de dados...');
    
    // Verificar se já existe dados
    const collections = ['users', 'questionnaires', 'questions', 'responses'];
    
    // Criar questionários de exemplo se não existirem
    const questionnaireSnapshot = await db.collection('questionnaires').limit(1).get();
    
    if (questionnaireSnapshot.empty) {
      console.log('📝 Criando questionários de exemplo com estrutura NoSQL embedded...');
      
      // Questionário 1 - COM QUESTÕES EMBEDDED
      await db.collection('questionnaires').add({
        title: 'Pesquisa de Satisfação - Serviços para Idosos',
        description: 'Avalie a qualidade dos serviços oferecidos para a terceira idade em nossa comunidade',
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        is_active: true,
        questions: [  // 🔥 QUESTÕES DENTRO DO DOCUMENTO!
          {
            id: 'q1',
            text: 'Como você avalia o atendimento que recebeu?',
            type: 'rating',
            options: null,
            order: 1,
            is_required: true
          },
          {
            id: 'q2',
            text: 'Você recomendaria nossos serviços para outros idosos?',
            type: 'yes_no',
            options: null,
            order: 2,
            is_required: true
          },
          {
            id: 'q3',
            text: 'Qual aspecto do atendimento você considera mais importante?',
            type: 'multiple_choice',
            options: ['Rapidez no atendimento', 'Gentileza dos funcionários', 'Clareza nas informações', 'Ambiente acolhedor', 'Facilidade de acesso'],
            order: 3,
            is_required: true
          }
        ]
      });
      
      // Questionário 2 - COM QUESTÕES EMBEDDED
      await db.collection('questionnaires').add({
        title: 'Avaliação de Acessibilidade',
        description: 'Como podemos melhorar a acessibilidade dos nossos serviços?',
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        is_active: true,
        questions: [  // 🔥 QUESTÕES DENTRO DO DOCUMENTO!
          {
            id: 'q1',
            text: 'Como você avalia a facilidade de acesso ao nosso local?',
            type: 'rating',
            options: null,
            order: 1,
            is_required: true
          },
          {
            id: 'q2',
            text: 'Que melhorias de acessibilidade você sugere?',
            type: 'text',
            options: null,
            order: 2,
            is_required: false
          }
        ]
      });
      
      console.log('✅ Questionários com estrutura NoSQL embedded criados!');
    } else {
      console.log('✅ Questionários já existem');
    }
  } catch (error) {
    console.error('❌ Erro ao inicializar estruturas:', error);
    throw error;
  }
}

// Inicializar o servidor
async function initializeServer() {
  try {
    console.log('🚀 Iniciando servidor...');
    
    // Criar usuário admin se não existir
    await createAdminUser();
    
    // Inicializar banco de dados automaticamente
    console.log('🔧 Inicializando estruturas do banco de dados...');
    try {
      // Simular uma requisição para o endpoint de inicialização
      await initializeDatabaseStructures();
    } catch (initError) {
      console.error('⚠️  Erro ao inicializar banco (continuando):', initError.message);
    }
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Servidor rodando na porta ${PORT} em todos os interfaces`);
      console.log(`🌐 Health check (local): http://localhost:${PORT}/api/health`);
      console.log(`🌐 Health check (Wi-Fi): http://172.20.10.4:${PORT}/api/health`);
      console.log(`📱 Para React Native: http://172.20.10.4:${PORT}/api/health`);
      console.log(`🧪 Network test: http://172.20.10.4:${PORT}/api/network-test`);
      console.log(`🔧 Database test: http://172.20.10.4:${PORT}/api/database-test`);
    });
  } catch (error) {
    console.error('❌ Erro ao inicializar servidor:', error);
    process.exit(1);
  }
}

// Função para criar usuário admin inicial
async function createAdminUser() {
  try {
    console.log('👑 Verificando usuário admin...');
    
    const adminSnapshot = await db.collection('users')
      .where('username', '==', 'admin')
      .limit(1)
      .get();

    if (adminSnapshot.empty) {
      console.log('👑 Criando usuário admin...');
      
      const adminPassword = 'admin123'; // ALTERE ISSO EM PRODUÇÃO!
      const password_hash = await bcrypt.hash(adminPassword, 12);
      
      await db.collection('users').add({
        username: 'admin',
        full_name: 'Administrador',
        email: 'admin@vivamais.com',
        password_hash,
        role: 'admin',
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        is_active: true
      });
      
      console.log('✅ Usuário admin criado com sucesso!');
      console.log('📝 Login: admin / Senha: admin123');
      console.log('⚠️  ALTERE A SENHA EM PRODUÇÃO!');
    } else {
      console.log('✅ Usuário admin já existe');
    }
  } catch (error) {
    console.error('❌ Erro ao criar usuário admin:', error);
  }
}

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
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
let genAI = null;
let geminiModel = null;

if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  console.log('✅ Gemini AI configurado com sucesso!');
} else {
  console.log('⚠️ GEMINI_API_KEY não configurada - usando análise estatística básica');
}

// Função auxiliar para coletar dados completos do questionário
async function collectQuestionnaireData(questionnaireId) {
  // 1. Buscar questionário com suas perguntas
  const qDoc = await db.collection('questionnaires').doc(questionnaireId).get();
  if (!qDoc.exists) {
    throw new Error('Questionário não encontrado');
  }
  const questionnaireData = qDoc.data();
  
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
    "satisfacao_geral": "X.X/5 ou N/A",
    "taxa_resposta_positiva": "XX%",
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
app.post('/api/generate-insights', authenticateToken, async (req, res) => {
  try {
    const { questionnaireId } = req.body;
    console.log(`🧠 Gerando insights para o questionário: ${questionnaireId}`);

    // 1. Coletar todos os dados necessários
    const rawData = await collectQuestionnaireData(questionnaireId);
    
    // Verificar se há dados suficientes
    if (rawData.totalRespondents === 0) {
      return res.json({ 
        success: true, 
        analysis: {
          strengths: ["Questionário criado com sucesso."],
          improvements: ["Ainda não há respostas registradas."],
          action_plan: ["Divulgue o questionário para coletar respostas.", "Compartilhe o link com os participantes."]
        },
        detailed: null,
        message: "Aguardando respostas para análise completa"
      });
    }

    // 2. Preparar dados para análise
    const analysisData = prepareDataForAnalysis(rawData);
    console.log(`📊 Dados preparados: ${analysisData.totalRespondents} respondentes, ${analysisData.questionStats.length} perguntas`);

    // 3. Verificar se Gemini está disponível
    if (geminiModel && GEMINI_API_KEY) {
      console.log('🤖 Usando Gemini AI para análise avançada...');
      
      try {
        const prompt = generateGeminiPrompt(analysisData);
        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        let aiText = response.text();
        
        // Limpar resposta do Gemini (remover markdown se houver)
        aiText = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        const aiAnalysis = JSON.parse(aiText);
        
        console.log('✅ Análise do Gemini concluída com sucesso!');
        
        // Converter para formato compatível com frontend existente + dados extras
        const analysis = {
          strengths: aiAnalysis.pontos_fortes || [],
          improvements: aiAnalysis.pontos_atencao || [],
          action_plan: aiAnalysis.plano_acao?.map(a => `[${a.prazo_sugerido?.toUpperCase()}] ${a.acao}`) || []
        };
        
        return res.json({ 
          success: true, 
          analysis,
          detailed: aiAnalysis,
          source: 'gemini-ai',
          stats: {
            totalRespondents: analysisData.totalRespondents,
            totalResponses: analysisData.totalResponses
          }
        });
        
      } catch (aiError) {
        console.error('⚠️ Erro no Gemini, usando fallback:', aiError.message);
        // Continua para análise estatística básica
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
        
        if (parseFloat(q.average) >= 4) {
          analysis.strengths.push(`"${q.text.substring(0, 50)}..." - Média alta: ${q.average}`);
        } else if (parseFloat(q.average) < 3) {
          analysis.improvements.push(`"${q.text.substring(0, 50)}..." - Média baixa: ${q.average}`);
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
    
    // Gerar insights baseados nos dados
    if (overallAverage >= 4) {
      analysis.strengths.push(`Satisfação geral alta (média ${overallAverage}/5)`);
    } else if (overallAverage >= 3) {
      analysis.improvements.push(`Satisfação moderada (média ${overallAverage}/5) - há espaço para melhorias`);
    } else if (overallAverage > 0) {
      analysis.improvements.push(`Satisfação baixa (média ${overallAverage}/5) - requer atenção imediata`);
    }
    
    if (positiveCount > negativeCount) {
      analysis.strengths.push(`Feedback textual majoritariamente positivo (${positiveCount} menções positivas)`);
    } else if (negativeCount > positiveCount) {
      analysis.improvements.push(`Detectados ${negativeCount} comentários com termos negativos`);
      analysis.action_plan.push("Revisar comentários de texto para identificar problemas específicos");
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
    
    res.json({ 
      success: true, 
      analysis,
      detailed: null,
      source: 'statistical-analysis',
      stats: {
        totalRespondents: analysisData.totalRespondents,
        totalResponses: analysisData.totalResponses,
        overallAverage
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