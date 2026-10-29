// O navegador acessa este servidor; somente o servidor acessa o MySQL.
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

function validarAluno(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const campos = ['nome', 'email', 'curso'];
  const limites = [100, 120, 100];
  const aluno = {};
  for (let i = 0; i < campos.length; i++) {
    const campo = campos[i];
    if (typeof body[campo] !== 'string') return null;
    aluno[campo] = body[campo].trim();
    if (!aluno[campo] || [...aluno[campo]].length > limites[i]) return null;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(aluno.email)) return null;
  return aluno;
}

function criarApp(db) {
  const app = express();
  app.use(express.json({ limit: '20kb' }));
  app.use(express.static(path.join(__dirname, 'public')));
  // Encaminha falhas assíncronas ao tratamento central de erros do Express 4.
  const rota = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
  function idValido(req, res, next) {
    const id = Number(req.params.id);
    if (!/^\d+$/.test(req.params.id) || !Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({ erro: 'ID inválido.' });
    }
    req.alunoId = id;
    next();
  }
  function dadosValidos(req, res, next) {
    req.aluno = validarAluno(req.body);
    if (!req.aluno) return res.status(400).json({ erro: 'Informe nome, e-mail válido e curso. Limites: 100, 120 e 100 caracteres.' });
    next();
  }
  app.get('/alunos', rota(async (req, res) => {
    const [rows] = await db.execute('SELECT id, nome, email, curso, created_at FROM alunos ORDER BY id DESC');
    res.json(rows);
  }));
  app.post('/alunos', dadosValidos, rota(async (req, res) => {
    const { nome, email, curso } = req.aluno;
    // Os parâmetros ? separam os dados do usuário do comando SQL.
    const [result] = await db.execute('INSERT INTO alunos (nome,email,curso) VALUES (?,?,?)', [nome, email, curso]);
    res.status(201).json({ id: result.insertId, nome, email, curso });
  }));
  app.put('/alunos/:id', idValido, dadosValidos, rota(async (req, res) => {
    const { nome, email, curso } = req.aluno;
    const [result] = await db.execute('UPDATE alunos SET nome=?, email=?, curso=? WHERE id=?', [nome, email, curso, req.alunoId]);
    if (result.affectedRows === 0) return res.status(404).json({ erro: 'Aluno não encontrado.' });
    res.json({ msg: 'Atualizado.' });
  }));
  app.delete('/alunos/:id', idValido, rota(async (req, res) => {
    const [result] = await db.execute('DELETE FROM alunos WHERE id=?', [req.alunoId]);
    if (result.affectedRows === 0) return res.status(404).json({ erro: 'Aluno não encontrado.' });
    res.json({ msg: 'Excluído.' });
  }));
  app.use((req, res) => res.status(404).json({ erro: 'Endereço não encontrado.' }));
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido.' });
    if (err.type === 'entity.too.large') return res.status(413).json({ erro: 'Dados excedem o tamanho permitido.' });
    console.error('Falha na operação:', err.code || err.message);
    res.status(500).json({ erro: 'Não foi possível concluir a operação. Verifique o terminal e o MySQL.' });
  });
  return app;
}

async function iniciar() {
  const arquivo = path.join(__dirname, 'config.json');
  if (!fs.existsSync(arquivo)) throw new Error('Copie config.example.json para config.json e configure a senha. Consulte o README.');
  const config = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  for (const key of ['host', 'user', 'password', 'database']) {
    if (typeof config[key] !== 'string' || !config[key].trim()) throw new Error(`Configuração inválida: ${key}.`);
  }
  for (const key of ['port', 'appPort']) {
    if (!Number.isInteger(config[key]) || config[key] < 1 || config[key] > 65535) throw new Error(`Porta inválida: ${key}.`);
  }
  const db = mysql.createPool({ host: config.host, port: config.port, user: config.user,
    password: config.password, database: config.database, waitForConnections: true, connectionLimit: 5 });
  try {
    // Não abre a porta da aplicação se o banco ou a tabela não estiverem disponíveis.
    await db.execute('SELECT id, nome, email, curso, created_at FROM alunos LIMIT 1');
  } catch (err) {
    await db.end();
    throw new Error(`MySQL: ${err.code || err.message}. Confira config.json e execute script.sql.`);
  }
  const server = criarApp(db).listen(config.appPort, '0.0.0.0', () => {
    console.log(`MySQL conectado. Abra http://localhost:${config.appPort} no navegador da VM.`);
  });
  server.on('error', async err => {
    console.error(`Servidor: ${err.code || err.message}`);
    await db.end();
    process.exitCode = 1;
  });
  const encerrar = () => server.close(async () => { await db.end(); });
  process.once('SIGINT', encerrar);
  process.once('SIGTERM', encerrar);
}
if (require.main === module) iniciar().catch(err => { console.error(err.message); process.exitCode = 1; });
module.exports = { criarApp, validarAluno };
