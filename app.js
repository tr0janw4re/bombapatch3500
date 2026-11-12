const SUPABASE_URL = 'https://kyxfwbudqongvalgxjrg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_bMSi5X7Khdg6_9bZzWy65A_nHN1hEnc';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (id) => document.getElementById(id);
const STATUS = { pendente: 'Pendente', em_andamento: 'Em andamento', concluida: 'Concluída' };
let categorias = [];

// ---------- Categorias ----------
async function carregarCategorias() {
  const { data, error } = await db.from('categorias').select('*').order('nome');
  if (error) return alert(error.message);
  categorias = data;

  const opcoes = categorias.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('');
  $('categoria').innerHTML = `<option value="">Selecione a categoria</option>${opcoes}`;
  const atual = $('filtro-categoria').value;
  $('filtro-categoria').innerHTML = `<option value="">Todas as categorias</option>${opcoes}`;
  $('filtro-categoria').value = atual;
}

$('form-categoria').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nome = $('cat-nome').value.trim();
  if (!nome) return;
  const { error } = await db.from('categorias').insert({ nome });
  if (error) return alert(error.code === '23505' ? 'Categoria já existe.' : error.message);
  $('cat-nome').value = '';
  carregarCategorias();
});

// ---------- Tarefas ----------
async function listar() {
  let q = db.from('tarefas').select('*, categorias(nome)').order('prazo', { ascending: true, nullsFirst: false });

  if ($('filtro-status').value) q = q.eq('status', $('filtro-status').value);
  if ($('filtro-categoria').value) q = q.eq('categoria_id', $('filtro-categoria').value);
  if ($('busca').value.trim()) q = q.ilike('titulo', `%${$('busca').value.trim()}%`);

  const { data, error } = await q;
  if (error) return alert(error.message);

  const hoje = new Date().toISOString().slice(0, 10);
  const cont = { pendente: 0, em_andamento: 0, concluida: 0 };
  data.forEach(t => cont[t.status]++);
  $('contadores').textContent =
    `Pendentes: ${cont.pendente} | Em andamento: ${cont.em_andamento} | Concluídas: ${cont.concluida}`;

  $('lista').innerHTML = data.length ? data.map(t => {
    const vencida = t.prazo && t.prazo < hoje && t.status !== 'concluida';
    return `
      <div class="tarefa ${t.status} ${vencida ? 'vencida' : ''}">
        <h3>${esc(t.titulo)}</h3>
        <p>${esc(t.descricao || '')}</p>
        <p class="meta">
          📁 ${esc(t.categorias?.nome || 'Sem categoria')} •
          <span class="prazo">📅 ${t.prazo ? formatarData(t.prazo) : 'Sem prazo'}${vencida ? ' (vencida)' : ''}</span>
        </p>
        <div class="acoes">
          <select onchange="mudarStatus(${t.id}, this.value)">
            ${Object.entries(STATUS).map(([v, l]) =>
              `<option value="${v}" ${v === t.status ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
          <button onclick="editar(${t.id})">Editar</button>
          <button class="perigo" onclick="excluir(${t.id})">Excluir</button>
        </div>
      </div>`;
  }).join('') : '<p>Nenhuma tarefa encontrada.</p>';
}

$('form-tarefa').addEventListener('submit', async (e) => {
  e.preventDefault();
  const titulo = $('titulo').value.trim();
  if (!titulo) return alert('Informe o título.');
  if (!$('categoria').value) return alert('Selecione uma categoria.');

  const dados = {
    titulo,
    descricao: $('descricao').value.trim() || null,
    prazo: $('prazo').value || null,
    categoria_id: Number($('categoria').value)
  };
  const id = $('tarefa-id').value;
  const { error } = id
    ? await db.from('tarefas').update(dados).eq('id', id)
    : await db.from('tarefas').insert(dados);
  if (error) return alert(error.message);

  limparForm();
  listar();
});

async function mudarStatus(id, status) {
  const { error } = await db.from('tarefas').update({ status }).eq('id', id);
  if (error) alert(error.message);
  listar();
}

async function editar(id) {
  const { data, error } = await db.from('tarefas').select('*').eq('id', id).single();
  if (error) return alert(error.message);
  $('tarefa-id').value = data.id;
  $('titulo').value = data.titulo;
  $('descricao').value = data.descricao || '';
  $('prazo').value = data.prazo || '';
  $('categoria').value = data.categoria_id || '';
  $('titulo-form').textContent = 'Editar tarefa';
  $('cancelar').hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function excluir(id) {
  if (!confirm('Excluir esta tarefa?')) return;
  const { error } = await db.from('tarefas').delete().eq('id', id);
  if (error) alert(error.message);
  listar();
}

function limparForm() {
  $('form-tarefa').reset();
  $('tarefa-id').value = '';
  $('titulo-form').textContent = 'Nova tarefa';
  $('cancelar').hidden = true;
}
$('cancelar').addEventListener('click', limparForm);

// ---------- Utilitários ----------
function formatarData(iso) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

['busca', 'filtro-status', 'filtro-categoria'].forEach(id =>
  $(id).addEventListener(id === 'busca' ? 'input' : 'change', listar));

(async () => { await carregarCategorias(); listar(); })();