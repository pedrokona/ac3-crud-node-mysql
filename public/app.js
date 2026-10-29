// O fetch utiliza a mesma origem do site; não precisa de CORS ou IP fixo.
const form = document.querySelector('#form-aluno');
const lista = document.querySelector('#lista');
const mensagem = document.querySelector('#mensagem');
const salvar = document.querySelector('#salvar');
const cancelar = document.querySelector('#cancelar');
let idEdicao = null;
let ocupado = false;
function informar(texto, erro = false) {
  mensagem.textContent = texto;
  mensagem.className = erro ? 'erro' : 'sucesso';
}
async function requisicao(url, options = {}) {
  const resposta = await fetch(url, options);
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados.erro || 'Falha na requisição.');
  return dados;
}
function limpar() {
  idEdicao = null;
  form.reset();
  salvar.textContent = 'Cadastrar';
  cancelar.hidden = true;
  document.querySelector('#titulo-form').textContent = 'Novo aluno';
}
function editar(aluno) {
  if (ocupado) return;
  idEdicao = aluno.id;
  for (const campo of ['nome', 'email', 'curso']) form.elements[campo].value = aluno[campo];
  salvar.textContent = 'Salvar alterações';
  cancelar.hidden = false;
  document.querySelector('#titulo-form').textContent = `Editar aluno #${aluno.id}`;
  form.elements.nome.focus();
}
function bloquear(valor) {
  ocupado = valor;
  for (const controle of document.querySelectorAll('button, input')) controle.disabled = valor;
}
async function carregar() {
  const alunos = await requisicao('/alunos');
  lista.replaceChildren();
  if (!alunos.length) {
    const linha = lista.insertRow();
    const celula = linha.insertCell(); celula.colSpan = 5; celula.textContent = 'Nenhum aluno cadastrado.';
  }
  for (const aluno of alunos) {
    const linha = lista.insertRow();
    // textContent exibe dados como texto, sem executar HTML do usuário.
    for (const campo of ['id', 'nome', 'email', 'curso']) linha.insertCell().textContent = aluno[campo];
    const acoes = linha.insertCell();
    const botaoEditar = document.createElement('button');
    botaoEditar.type = 'button'; botaoEditar.textContent = 'Editar';
    botaoEditar.addEventListener('click', () => editar(aluno));
    const botaoExcluir = document.createElement('button');
    botaoExcluir.type = 'button'; botaoExcluir.textContent = 'Excluir'; botaoExcluir.className = 'perigo';
    botaoExcluir.addEventListener('click', () => excluir(aluno));
    acoes.append(botaoEditar, botaoExcluir);
  }
}
async function atualizarAposOperacao(texto) {
  try { await carregar(); informar(texto); }
  catch (err) { informar(`${texto} Porém, a lista não foi atualizada: ${err.message}`, true); }
}
async function excluir(aluno) {
  if (ocupado || !confirm(`Excluir o aluno ${aluno.nome}?`)) return;
  bloquear(true);
  try {
    await requisicao(`/alunos/${aluno.id}`, { method: 'DELETE' });
    if (idEdicao === aluno.id) limpar();
    await atualizarAposOperacao('Aluno excluído.');
  } catch (err) { informar(err.message, true); }
  finally { bloquear(false); }
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (ocupado) return;
  const dados = {};
  for (const campo of ['nome', 'email', 'curso']) dados[campo] = form.elements[campo].value.trim();
  if (Object.values(dados).some(valor => !valor)) return informar('Preencha todos os campos.', true);
  const editando = idEdicao !== null;
  bloquear(true);
  try {
    await requisicao(editando ? `/alunos/${idEdicao}` : '/alunos', {
      method: editando ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados)
    });
    limpar();
    await atualizarAposOperacao(editando ? 'Aluno atualizado.' : 'Aluno cadastrado.');
  } catch (err) { informar(err.message, true); }
  finally { bloquear(false); }
});
cancelar.addEventListener('click', limpar);
document.querySelector('#recarregar').addEventListener('click', async () => {
  if (ocupado) return;
  bloquear(true);
  try { await carregar(); informar('Lista atualizada.'); }
  catch (err) { informar(err.message, true); }
  finally { bloquear(false); }
});
bloquear(true);
carregar().catch(err => informar(`Não foi possível carregar os alunos: ${err.message}`, true)).finally(() => bloquear(false));
