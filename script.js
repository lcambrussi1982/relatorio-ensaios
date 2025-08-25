/* ======= Modelo de dados ======= */
const ENSAIOS_DEFAULT = [
  { ensaio: "Efeito sobre a água (Inocuidade)", norma: "ABNT NBR 8219" },
  { ensaio: "Temperatura de amolecimento Vicat", norma: "ABNT NBR NM 82" },
  { ensaio: "Presença de chumbo", norma: "EN 62321-3-1:2014" },
  { ensaio: "Teor de cinzas", norma: "ABNT NBR NM 84" },
  { ensaio: "Resistência à pressão hidrostática interna", norma: "ABNT NBR 8218" },
  { ensaio: "Características geométricas", norma: "ABNT NBR 14264" },
  { ensaio: "Desempenho da junta soldável", norma: "ABNT NBR 7371" },
];

const STORAGE_KEY = "relatorios-ensaio-v1";

/* ======= Utilidades ======= */
const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
const uid = () => crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+Math.random();

/* ======= Estado ======= */
let relatorios = loadAll();
let atual = novoRelatorio();

/* ======= Init ======= */
document.addEventListener("DOMContentLoaded", () => {
  $("#ano").textContent = new Date().getFullYear();

  montarMetodos();
  montarAmostrasUI();
  montarResultadosUI();
  preencherForm(atual);
  desenharLista();

  $("#btnAddAmostra").addEventListener("click", addAmostra);
  $("#btnAddResultado").addEventListener("click", addResultado);

  $("#btnNovo").addEventListener("click", () => {
    atual = novoRelatorio();
    preencherForm(atual);
  });

  $("#btnSalvar").addEventListener("click", salvarAtual);
  $("#btnExportar").addEventListener("click", exportarJSON);
  $("#inputImportar").addEventListener("change", importarJSON);
  $("#btnImprimir").addEventListener("click", () => window.print());

  $("#filtroLista").addEventListener("input", desenharLista);
});

/* ======= Modelo / CRUD ======= */
function novoRelatorio(){
  return {
    id: uid(),
    numeroRelatorio: "",
    revisao: "",
    dataEmissao: "",
    responsavelTecnico: "",
    laboratorio: "",
    normasReferencia: [],
    amostras: [novaAmostra()],
    objetivo: "Apresentar resultados obtidos nos ensaios realizados em conexões de PVC-U, visando verificar a conformidade com os requisitos das normas técnicas aplicáveis.",
    metodos: ENSAIOS_DEFAULT.map(m => ({...m, aplicado: false})),
    resultados: [],
    discussao: "",
    conclusao: { status: "Conforme", observacoes: "" },
    anexos: { certificados: [], planilhas: [], fotos: [] },
    updatedAt: Date.now()
  };
}
function novaAmostra(){
  return { descricao:"", tipo:"", dimensao:"", cor:"", processo:"", marca:"", lote:"", quantidade:"" };
}

function loadAll(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ console.error(e); return []; }
}
function persistAll(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(relatorios));
}

function salvarAtual(){
  if(!$("#formRelatorio").reportValidity()) return;

  const data = coletarForm();
  data.updatedAt = Date.now();

  const ix = relatorios.findIndex(r => r.id === data.id);
  if(ix >= 0) relatorios[ix] = data; else relatorios.unshift(data);

  persistAll();
  desenharLista();
  alert("Relatório salvo!");
}

/* ======= Form <-> Estado ======= */
function preencherForm(r){
  const f = $("#formRelatorio");
  f.numeroRelatorio.value = r.numeroRelatorio || "";
  f.revisao.value = r.revisao || "";
  f.dataEmissao.value = r.dataEmissao || "";
  f.responsavelTecnico.value = r.responsavelTecnico || "";
  f.laboratorio.value = r.laboratorio || "";
  f.normasReferencia.value = (r.normasReferencia||[]).join("; ");
  f.objetivo.value = r.objetivo || "";
  f.discussao.value = r.discussao || "";
  f.statusConclusao.value = r.conclusao?.status || "Conforme";
  f.conclusaoObs.value = r.conclusao?.observacoes || "";
  f.anexosCertificados.value = (r.anexos?.certificados||[]).join("; ");
  f.anexosPlanilhas.value = (r.anexos?.planilhas||[]).join("; ");
  f.anexosFotos.value = (r.anexos?.fotos||[]).join("; ");
  f.id.value = r.id;

  // amostras
  const wrap = $("#amostras");
  wrap.innerHTML = "";
  (r.amostras||[]).forEach((a, idx) => wrap.appendChild(amostraCard(a, idx)));

  // metodos
  $$("#metodos input[type='checkbox']").forEach((chk, i) => {
    chk.checked = !!r.metodos[i]?.aplicado;
  });

  // resultados
  const tbody = $("#tblResultados tbody");
  tbody.innerHTML = "";
  (r.resultados||[]).forEach((row, i) => tbody.appendChild(resultadoRow(row, i)));
}

function coletarForm(){
  const f = $("#formRelatorio");
  const r = {
    id: f.id.value || uid(),
    numeroRelatorio: f.numeroRelatorio.value.trim(),
    revisao: f.revisao.value.trim(),
    dataEmissao: f.dataEmissao.value,
    responsavelTecnico: f.responsavelTecnico.value.trim(),
    laboratorio: f.laboratorio.value.trim(),
    normasReferencia: splitList(f.normasReferencia.value),
    amostras: $$("[data-amostra]", $("#amostras")).map(card => ({
      descricao: $(".a-descricao", card).value.trim(),
      tipo: $(".a-tipo", card).value.trim(),
      dimensao: $(".a-dimensao", card).value.trim(),
      cor: $(".a-cor", card).value.trim(),
      processo: $(".a-processo", card).value.trim(),
      marca: $(".a-marca", card).value.trim(),
      lote: $(".a-lote", card).value.trim(),
      quantidade: $(".a-quantidade", card).value.trim()
    })),
    objetivo: f.objetivo.value.trim(),
    metodos: $$("#metodos .metodo").map((m, i) => {
      const base = ENSAIOS_DEFAULT[i];
      return { ...base, aplicado: $("input[type='checkbox']", m).checked };
    }),
    resultados: $$("tbody tr", $("#tblResultados")).map(tr => ({
      ensaio: $(".r-ensaio", tr).value.trim(),
      resultado: $(".r-resultado", tr).value.trim(),
      requisito: $(".r-requisito", tr).value.trim(),
      conformidade: $(".r-conf", tr).value
    })),
    discussao: f.discussao.value.trim(),
    conclusao: { status: f.statusConclusao.value, observacoes: f.conclusaoObs.value.trim() },
    anexos: {
      certificados: splitList(f.anexosCertificados.value),
      planilhas: splitList(f.anexosPlanilhas.value),
      fotos: splitList(f.anexosFotos.value),
    },
    updatedAt: Date.now()
  };
  return r;
}
const splitList = (s) => (s||"")
  .split(";")
  .map(x => x.trim())
  .filter(Boolean);

/* ======= UI builders ======= */
function amostraCard(a={}, idx=0){
  const div = document.createElement("div");
  div.className = "grid";
  div.dataset.amostra = idx;
  div.innerHTML = `
    <label>Descrição <input class="a-descricao" value="${a.descricao||""}" required></label>
    <label>Tipo <input class="a-tipo" value="${a.tipo||""}"></label>
    <label>Dimensão nominal <input class="a-dimensao" value="${a.dimensao||""}"></label>
    <label>Cor <input class="a-cor" value="${a.cor||""}"></label>
    <label>Processo de fabricação <input class="a-processo" value="${a.processo||""}"></label>
    <label>Marca <input class="a-marca" value="${a.marca||""}"></label>
    <label>Lote/Nº amostra <input class="a-lote" value="${a.lote||""}"></label>
    <label>Qtd. de amostras <input class="a-quantidade" value="${a.quantidade||""}" type="number" min="0"></label>
    <div>
      <button type="button" class="secundario" data-remove>Remover amostra</button>
    </div>
  `;
  $("button[data-remove]", div).addEventListener("click", () => {
    div.remove();
  });
  return div;
}
function montarAmostrasUI(){ /* já é dinâmico pelo preencherForm */ }

function montarMetodos(){
  const wrap = $("#metodos");
  wrap.innerHTML = "";
  ENSAIOS_DEFAULT.forEach(m => {
    const lab = document.createElement("label");
    lab.className = "metodo";
    lab.innerHTML = `
      <input type="checkbox" />
      <span><strong>${m.ensaio}</strong> — <em>${m.norma}</em></span>
    `;
    wrap.appendChild(lab);
  });
}

function resultadoRow(row={}, idx=0){
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="r-ensaio" placeholder="Ensaio" value="${row.ensaio||""}"></td>
    <td><input class="r-resultado" placeholder="Resultado obtido" value="${row.resultado||""}"></td>
    <td><input class="r-requisito" placeholder="Requisito normativo" value="${row.requisito||""}"></td>
    <td>
      <select class="r-conf">
        <option ${row.conformidade==="Conforme"?"selected":""}>Conforme</option>
        <option ${row.conformidade==="Não conforme"?"selected":""}>Não conforme</option>
      </select>
    </td>
    <td><button type="button" class="del">Excluir</button></td>
  `;
  $(".del", tr).addEventListener("click", () => tr.remove());
  return tr;
}
function montarResultadosUI(){ /* preenchido por preencherForm */ }

function addAmostra(){ $("#amostras").appendChild(amostraCard(novaAmostra())); }
function addResultado(){ $("#tblResultados tbody").appendChild(resultadoRow({})); }

/* ======= Lista lateral ======= */
function desenharLista(){
  const termo = ($("#filtroLista").value||"").toLowerCase();
  const ul = $("#listaRelatorios"); ul.innerHTML = "";
  const items = relatorios
    .filter(r => [r.numeroRelatorio, r.responsavelTecnico, r.laboratorio].join(" ").toLowerCase().includes(termo))
    .sort((a,b)=> b.updatedAt - a.updatedAt);

  items.forEach(r => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${r.numeroRelatorio || "(sem nº)"} – ${r.responsavelTecnico||"Responsável?"}</strong>
      <span class="meta">${new Date(r.updatedAt).toLocaleString()} • ${r.laboratorio||""}</span>
      <div class="row-actions">
        <button data-open>Abrir</button>
        <button data-delete class="del">Apagar</button>
      </div>
    `;
    $("button[data-open]", li).addEventListener("click", () => {
      atual = r;
      preencherForm(atual);
      window.scrollTo({top:0, behavior:"smooth"});
    });
    $("button[data-delete]", li).addEventListener("click", () => {
      if(confirm("Apagar este relatório?")){
        relatorios = relatorios.filter(x => x.id !== r.id);
        persistAll(); desenharLista();
      }
    });
    ul.appendChild(li);
  });

  if(!items.length){
    const li = document.createElement("li");
    li.textContent = "Nenhum relatório salvo.";
    ul.appendChild(li);
  }
}

/* ======= Exportar / Importar ======= */
function exportarJSON(){
  const blob = new Blob([JSON.stringify(coletarForm(), null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `relatorio-${($("#formRelatorio").numeroRelatorio.value||"sem-numero")}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
function importarJSON(ev){
  const file = ev.target.files?.[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const data = JSON.parse(reader.result);
      atual = data;
      // garante compatibilidade de versão
      if(!atual.metodos) atual.metodos = ENSAIOS_DEFAULT.map(m => ({...m, aplicado:false}));
      preencherForm(atual);
      // opcional: já salva ao importar
      salvarAtual();
    }catch(e){
      alert("Arquivo inválido.");
    }
    ev.target.value = "";
  };
  reader.readAsText(file);
}
