"use strict";

/* =========================================================
   Distrito de Estudiantes · lógica de la aplicación
   ========================================================= */

const CLAVE_STORAGE = "distrito_estudiantes_ubicaciones_v1";
const CLAVE_NUEVOS = "distrito_estudiantes_alumnos_nuevos_v1";
const CLAVE_EDICIONES = "distrito_estudiantes_alumnos_ediciones_v1";
const NOTAS_KEYS = ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];

const ORDEN_GRADOS = [
  "1 PRIM", "2 PRIM", "3 PRIM", "4 PRIM", "5 PRIM", "6 PRIM",
  "1 SEC", "2 SEC", "3 SEC", "4 SEC", "5 SEC",
  "3 AÑOS", "4 AÑOS", "5 AÑOS"
];

const NIVEL_GRADO = {};
["1 PRIM", "2 PRIM", "3 PRIM", "4 PRIM", "5 PRIM", "6 PRIM"].forEach(g => { NIVEL_GRADO[g] = "prim"; });
["1 SEC", "2 SEC", "3 SEC", "4 SEC", "5 SEC"].forEach(g => { NIVEL_GRADO[g] = "sec"; });
["3 AÑOS", "4 AÑOS", "5 AÑOS"].forEach(g => { NIVEL_GRADO[g] = "ini"; });

const ESTADO = {
  ubicaciones: {},
  alumnos: [],
  filtrados: [],
  nuevos: [],
  ediciones: {},
  editando: null,
  gradosSel: null
};

/* ---------------- Utilidades ---------------- */

function etiquetaGrado(grado) {
  const n = parseInt(grado, 10);
  if (grado.endsWith("PRIM")) return n + "° de Primaria";
  if (grado.endsWith("SEC")) return n + "° de Secundaria";
  return n + " años (Inicial)";
}

function parseSeccion(seccion) {
  const partes = String(seccion || "").trim().split(/\s+/);
  if (partes.includes("PRIM")) return { grado: partes[0] + " PRIM", letra: "" };
  if (partes.includes("SEC")) {
    const letra = partes.length === 3 ? partes[1].toUpperCase() : "";
    return { grado: partes[0] + " SEC", letra };
  }
  return { grado: String(seccion || "").trim().toUpperCase(), letra: "" };
}

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function idDe(alumno) {
  return alumno.seccion + "|" + alumno.fila;
}

function aplanarAlumnos(datos) {
  const lista = [];
  Object.keys(datos).forEach(seccion => {
    datos[seccion].forEach(registro => {
      const { grado, letra } = parseSeccion(registro.seccion || seccion);
      const notas = {};
      NOTAS_KEYS.forEach(k => { notas[k] = registro[k] == null ? "" : String(registro[k]); });
      lista.push({
        id: idDe({ seccion: registro.seccion || seccion, fila: registro.fila }),
        nombre: registro.nombre || "(sin nombre)",
        fila: registro.fila,
        seccion: registro.seccion || seccion,
        seccion_num: registro.seccion_num || seccionNum(registro.seccion || seccion),
        grado,
        letra,
        notas
      });
    });
  });
  return lista;
}

function construirSeccion(grado, letra) {
  if (grado.endsWith("SEC") && letra) return grado.split(" ")[0] + " " + letra + " SEC";
  return grado;
}

function siguienteFila(seccion) {
  let max = 0;
  ESTADO.alumnos.forEach(a => {
    if (a.seccion === seccion) {
      const n = parseInt(a.fila, 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return max + 1;
}

function seccionNum(seccion) {
  const origen = ALUMNOS_DATA[seccion];
  if (origen && origen[0] && origen[0].seccion_num) return origen[0].seccion_num;
  const indice = Object.keys(ALUMNOS_DATA).indexOf(seccion);
  return indice >= 0 ? indice + 1 : Object.keys(ALUMNOS_DATA).length + 1;
}

function aplicarEdiciones(lista) {
  return lista.map(a => {
    const ed = ESTADO.ediciones[a.id];
    if (!ed) return a;
    const seccion = ed.seccion || a.seccion;
    const { grado, letra } = parseSeccion(seccion);
    return Object.assign({}, a, {
      nombre: ed.nombre || a.nombre,
      seccion,
      grado,
      letra
    });
  });
}

function reconstruirAlumnos() {
  ESTADO.alumnos = aplicarEdiciones(aplanarAlumnos(ALUMNOS_DATA)).concat(ESTADO.nuevos);
}

/* ---------------- Persistencia ---------------- */

function cargarUbicaciones() {
  try {
    const crudo = window.localStorage.getItem(CLAVE_STORAGE);
    ESTADO.ubicaciones = crudo ? JSON.parse(crudo) : {};
  } catch (e) {
    ESTADO.ubicaciones = {};
    avisar("No se pudo acceder al almacenamiento del navegador: " + e.message, true);
  }
}

function cargarNuevos() {
  try {
    const crudo = window.localStorage.getItem(CLAVE_NUEVOS);
    const lista = crudo ? JSON.parse(crudo) : [];
    ESTADO.nuevos = Array.isArray(lista) ? lista.map(completarNuevo) : [];
  } catch (e) {
    ESTADO.nuevos = [];
  }
}

function cargarEdiciones() {
  try {
    const crudo = window.localStorage.getItem(CLAVE_EDICIONES);
    const mapa = crudo ? JSON.parse(crudo) : {};
    ESTADO.ediciones = (mapa && typeof mapa === "object") ? mapa : {};
  } catch (e) {
    ESTADO.ediciones = {};
  }
}

function guardarEdiciones() {
  try {
    window.localStorage.setItem(CLAVE_EDICIONES, JSON.stringify(ESTADO.ediciones));
  } catch (e) {
    avisar("No se pudieron guardar los cambios: " + e.message, true);
  }
}

function completarNuevo(n) {
  const notas = {};
  NOTAS_KEYS.forEach(k => { notas[k] = (n.notas && n.notas[k]) || ""; });
  return {
    id: n.id,
    nombre: n.nombre || "(sin nombre)",
    fila: n.fila,
    seccion: n.seccion,
    grado: n.grado,
    letra: n.letra || "",
    seccion_num: n.seccion_num || seccionNum(n.seccion),
    notas,
    esNuevo: true
  };
}

function guardarNuevos() {
  try {
    window.localStorage.setItem(CLAVE_NUEVOS, JSON.stringify(ESTADO.nuevos));
  } catch (e) {
    avisar("No se pudieron guardar los alumnos nuevos: " + e.message, true);
  }
}

let temporizadorGuardado = null;

function guardarUbicaciones() {
  try {
    window.localStorage.setItem(CLAVE_STORAGE, JSON.stringify(ESTADO.ubicaciones));
    avisar("Guardado ✓ " + new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  } catch (e) {
    avisar("No se pudo guardar: " + e.message, true);
  }
}

function agendarGuardado() {
  window.clearTimeout(temporizadorGuardado);
  temporizadorGuardado = window.setTimeout(guardarUbicaciones, 400);
}

function avisar(texto, esError) {
  const el = document.getElementById("estado-guardado");
  if (!el) return;
  el.textContent = texto;
  el.style.color = esError ? "#c62828" : "";
}

function ubicacionDe(alumno) {
  return ESTADO.ubicaciones[alumno.id] || { provincia: "", distrito: "", direccion: "" };
}

function setUbicacion(alumno, campo, valor) {
  const actual = Object.assign({}, ubicacionDe(alumno));
  actual[campo] = valor;
  ESTADO.ubicaciones[alumno.id] = actual;
  agendarGuardado();
}

/* ---------------- Poblado de selects ---------------- */

function opcionesProvincias(select, incluirTodas) {
  select.innerHTML = "";
  if (incluirTodas) {
    const op = document.createElement("option");
    op.value = "todas";
    op.textContent = "Todas las provincias";
    select.appendChild(op);
  }
  Object.keys(UBIGEO_LIMA).forEach(prov => {
    const op = document.createElement("option");
    op.value = prov;
    op.textContent = prov + " (" + UBIGEO_LIMA[prov].length + " distritos)";
    select.appendChild(op);
  });
}

function opcionesDistritos(select, provincia, incluirTodos) {
  select.innerHTML = "";
  const opBase = document.createElement("option");
  opBase.value = incluirTodos ? "todos" : "";
  opBase.textContent = incluirTodos ? "Todos los distritos" : "— Seleccione provincia —";
  select.appendChild(opBase);

  const lista = provincia && UBIGEO_LIMA[provincia] ? UBIGEO_LIMA[provincia] : [];
  lista.forEach(dist => {
    const op = document.createElement("option");
    op.value = dist;
    op.textContent = dist;
    select.appendChild(op);
  });
  select.disabled = lista.length === 0;
}

let firmaGrados = "";

function gradosDisponibles() {
  return ORDEN_GRADOS.filter(g => ESTADO.alumnos.some(a => a.grado === g));
}

function gradoActivo(g) {
  return ESTADO.gradosSel === null || ESTADO.gradosSel.has(g);
}

function resumenGrados() {
  const disponibles = gradosDisponibles();
  if (ESTADO.gradosSel === null) return "Todos los grados";
  const sel = disponibles.filter(g => ESTADO.gradosSel.has(g));
  if (sel.length === 0) return "Ningún grado seleccionado";
  if (sel.length === 1) return etiquetaGrado(sel[0]);
  if (sel.length === disponibles.length) return "Todos los grados";
  return sel.length + " grados seleccionados";
}

function haySecundariaSeleccionada() {
  if (ESTADO.gradosSel === null) return false;
  return Array.from(ESTADO.gradosSel).some(g => g.endsWith("SEC"));
}

function sincronizarSeccionSegunGrado() {
  const selSeccion = document.getElementById("f-seccion");
  const habilitar = haySecundariaSeleccionada();
  selSeccion.disabled = !habilitar;
  if (!habilitar) selSeccion.value = "todas";
}

function popularGrados() {
  const disponibles = gradosDisponibles();
  const conteos = {};
  disponibles.forEach(g => { conteos[g] = ESTADO.alumnos.filter(a => a.grado === g).length; });

  const grupos = {
    prim: { cont: document.getElementById("og-prim"), titulo: "Primaria (1° a 6°)" },
    sec: { cont: document.getElementById("og-sec"), titulo: "Secundaria (1° a 5°)" },
    ini: { cont: document.getElementById("og-ini"), titulo: "Inicial (3 a 5 años)" }
  };

  const firma = disponibles.map(g => g + ":" + conteos[g]).join("|");
  if (firma !== firmaGrados) {
    firmaGrados = firma;
    Object.keys(grupos).forEach(k => { grupos[k].cont.innerHTML = ""; });

    disponibles.forEach(g => {
      const nivel = NIVEL_GRADO[g];
      const cont = grupos[nivel] && grupos[nivel].cont;
      if (!cont) return;

      if (!cont.querySelector(".ms-grupo-titulo")) {
        const titulo = document.createElement("p");
        titulo.className = "ms-grupo-titulo";
        titulo.textContent = grupos[nivel].titulo;
        cont.appendChild(titulo);
      }

      const label = document.createElement("label");
      label.className = "ms-opcion";

      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.className = "ms-check";
      chk.value = g;

      const texto = document.createElement("span");
      texto.textContent = etiquetaGrado(g);

      const conteo = document.createElement("span");
      conteo.className = "ms-conteo";
      conteo.textContent = conteos[g];

      label.appendChild(chk);
      label.appendChild(texto);
      label.appendChild(conteo);
      cont.appendChild(label);
    });
  }

  document.querySelectorAll("#f-grado-panel .ms-check").forEach(chk => {
    chk.checked = gradoActivo(chk.value);
  });

  const texto = document.getElementById("f-grado-texto");
  if (texto) texto.textContent = resumenGrados();
}

function aplicarSeleccionGrados() {
  const checks = Array.prototype.slice.call(document.querySelectorAll("#f-grado-panel .ms-check"));
  const elegidos = checks.filter(c => c.checked).map(c => c.value);
  ESTADO.gradosSel = (checks.length > 0 && elegidos.length === checks.length)
    ? null
    : new Set(elegidos);
  sincronizarSeccionSegunGrado();
  render();
}

function cerrarPanelGrado() {
  const panel = document.getElementById("f-grado-panel");
  if (!panel || panel.hidden) return;
  panel.hidden = true;
  document.getElementById("f-grado-btn").setAttribute("aria-expanded", "false");
  document.getElementById("ms-grado").classList.remove("abierto");
}

/* ---------------- Filtrado y orden ---------------- */

function leerFiltros() {
  return {
    q: normalizar(document.getElementById("f-buscar").value),
    grados: ESTADO.gradosSel,
    seccion: document.getElementById("f-seccion").value,
    provincia: document.getElementById("f-provincia").value,
    distrito: document.getElementById("f-distrito").value,
    orden: document.getElementById("f-orden").value
  };
}

function aplicarFiltros() {
  const f = leerFiltros();

  const lista = ESTADO.alumnos.filter(a => {
    if (f.q && !normalizar(a.nombre).includes(f.q) && !normalizar(a.seccion).includes(f.q)) return false;
    if (f.grados && !f.grados.has(a.grado)) return false;
    if (f.seccion !== "todas") {
      if (f.seccion === "A" && a.letra !== "A") return false;
      if (f.seccion === "B" && a.letra !== "B") return false;
    }
    const u = ubicacionDe(a);
    if (f.provincia !== "todas" && u.provincia !== f.provincia) return false;
    if (f.distrito !== "todos" && u.distrito !== f.distrito) return false;
    return true;
  });

  lista.sort((x, y) => {
    if (f.orden === "nombre") return x.nombre.localeCompare(y.nombre, "es");
    if (f.orden === "distrito") {
      const dx = ubicacionDe(x).distrito || "\uffff";
      const dy = ubicacionDe(y).distrito || "\uffff";
      return dx.localeCompare(dy, "es") || x.nombre.localeCompare(y.nombre, "es");
    }
    const ix = ORDEN_GRADOS.indexOf(x.grado);
    const iy = ORDEN_GRADOS.indexOf(y.grado);
    return (ix - iy) || x.nombre.localeCompare(y.nombre, "es");
  });

  ESTADO.filtrados = lista;
}

/* ---------------- Render ---------------- */

function crearFila(alumno) {
  const u = ubicacionDe(alumno);
  const tr = document.createElement("tr");
  if (!u.distrito) tr.classList.add("sin-distrito");

  const tdN = document.createElement("td");
  tdN.className = "col-n";
  tdN.textContent = alumno.fila;
  tr.appendChild(tdN);

  const tdNombre = document.createElement("td");
  const span = document.createElement("span");
  span.className = "nombre";
  span.textContent = alumno.nombre;
  const meta = document.createElement("span");
  meta.className = "fila-meta";
  meta.textContent = alumno.seccion + " · fila " + alumno.fila;
  tdNombre.appendChild(span);
  tdNombre.appendChild(meta);

  const acciones = document.createElement("div");
  acciones.className = "acciones-fila";

  const btnEditar = document.createElement("button");
  btnEditar.type = "button";
  btnEditar.className = "btn-editar";
  btnEditar.textContent = "✎ Editar";
  btnEditar.addEventListener("click", () => abrirModalEdicion(alumno));
  acciones.appendChild(btnEditar);

  if (!alumno.esNuevo && ESTADO.ediciones[alumno.id]) {
    const btnRestaurar = document.createElement("button");
    btnRestaurar.type = "button";
    btnRestaurar.className = "btn-restaurar";
    btnRestaurar.textContent = "↺ Restaurar original";
    btnRestaurar.title = "Deshacer los cambios de nombre/grado y volver a los datos del JSON";
    btnRestaurar.addEventListener("click", () => deshacerEdicion(alumno));
    acciones.appendChild(btnRestaurar);
  }

  if (alumno.esNuevo) {
    const btnBorrar = document.createElement("button");
    btnBorrar.type = "button";
    btnBorrar.className = "btn-eliminar";
    btnBorrar.textContent = "✕ Eliminar";
    btnBorrar.addEventListener("click", () => eliminarNuevo(alumno));
    acciones.appendChild(btnBorrar);
  }

  tdNombre.appendChild(acciones);
  tr.appendChild(tdNombre);

  const tdGrado = document.createElement("td");
  tdGrado.className = "col-grado";
  const badge = document.createElement("span");
  badge.className = "badge-grado " + (NIVEL_GRADO[alumno.grado] || "");
  badge.textContent = etiquetaGrado(alumno.grado) + (alumno.letra ? " · " + alumno.letra : "");
  tdGrado.appendChild(badge);
  tr.appendChild(tdGrado);

  const tdProv = document.createElement("td");
  const selProv = document.createElement("select");
  selProv.className = "celda-select";
  opcionesProvincias(selProv, true);
  selProv.value = u.provincia || "todas";
  selProv.addEventListener("change", () => {
    const valor = selProv.value === "todas" ? "" : selProv.value;
    setUbicacion(alumno, "provincia", valor);
    if (!valor) {
      setUbicacion(alumno, "distrito", "");
      selDist.value = "";
      selDist.disabled = true;
    } else {
      opcionesDistritos(selDist, valor, false);
      const actual = ubicacionDe(alumno).distrito;
      selDist.disabled = false;
      if (!UBIGEO_LIMA[valor].includes(actual)) {
        selDist.value = "";
        setUbicacion(alumno, "distrito", "");
      } else {
        selDist.value = actual;
      }
    }
    tr.classList.toggle("sin-distrito", !ubicacionDe(alumno).distrito);
    actualizarStats();
  });
  tdProv.appendChild(selProv);
  tr.appendChild(tdProv);

  const tdDist = document.createElement("td");
  const selDist = document.createElement("select");
  selDist.className = "celda-select" + (u.distrito ? "" : " pendiente");
  if (u.provincia && UBIGEO_LIMA[u.provincia]) {
    opcionesDistritos(selDist, u.provincia, false);
    selDist.value = u.distrito || "";
    selDist.disabled = false;
  } else {
    opcionesDistritos(selDist, "", false);
    selDist.disabled = true;
  }
  selDist.addEventListener("change", () => {
    setUbicacion(alumno, "distrito", selDist.value);
    selDist.classList.toggle("pendiente", !selDist.value);
    tr.classList.toggle("sin-distrito", !selDist.value);
    actualizarStats();
  });
  tdDist.appendChild(selDist);
  tr.appendChild(tdDist);

  const tdDir = document.createElement("td");
  const input = document.createElement("input");
  input.className = "celda-texto";
  input.type = "text";
  input.placeholder = "Calle, urbanización, referencia…";
  input.value = u.direccion || "";
  input.addEventListener("input", () => {
    setUbicacion(alumno, "direccion", input.value);
  });
  tdDir.appendChild(input);
  tr.appendChild(tdDir);

  return tr;
}

function render() {
  popularGrados();
  aplicarFiltros();

  const tbody = document.getElementById("tbody");
  const vacio = document.getElementById("vacio");
  const frag = document.createDocumentFragment();

  ESTADO.filtrados.forEach(a => frag.appendChild(crearFila(a)));
  tbody.innerHTML = "";
  tbody.appendChild(frag);

  vacio.hidden = ESTADO.filtrados.length > 0;

  document.getElementById("resultados").textContent =
    "Mostrando " + ESTADO.filtrados.length + " de " + ESTADO.alumnos.length + " alumnos.";

  actualizarStats();
}

function actualizarStats() {
  const total = ESTADO.alumnos.length;
  let conDistrito = 0;
  const provincias = new Set();

  ESTADO.alumnos.forEach(a => {
    const u = ubicacionDe(a);
    if (u.distrito) {
      conDistrito++;
      if (u.provincia) provincias.add(u.provincia);
    }
  });

  const datos = [
    { n: total, t: "Alumnos en el JSON", c: "" },
    { n: ESTADO.filtrados.length, t: "Visible con filtros", c: "" },
    { n: conDistrito, t: "Con distrito asignado", c: "ok" },
    { n: total - conDistrito, t: "Sin distrito todavía", c: "warn" },
    { n: provincias.size, t: "Provincias distintas", c: "" },
    { n: TOTAL_DISTRITOS, t: "Distritos de Lima disponibles", c: "" }
  ];

  const cont = document.getElementById("stats");
  cont.innerHTML = "";
  datos.forEach(d => {
    const div = document.createElement("div");
    div.className = "stat " + d.c;
    const b = document.createElement("b");
    b.textContent = d.n;
    const s = document.createElement("span");
    s.textContent = d.t;
    div.appendChild(b);
    div.appendChild(s);
    cont.appendChild(div);
  });

  document.getElementById("foot-info").textContent =
    total + " alumnos · " + conDistrito + " con distrito · datos guardados localmente en tu navegador";
}

/* ---------------- Exportar / importar ---------------- */

function descargar(nombre, contenido, tipo) {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function exportarJSON() {
  const salida = {};
  Object.keys(ALUMNOS_DATA).forEach(seccion => { salida[seccion] = []; });

  ESTADO.alumnos.forEach(alumno => {
    const u = ubicacionDe(alumno);
    const registro = {
      nombre: alumno.nombre,
      fila: alumno.fila,
      seccion: alumno.seccion,
      seccion_num: alumno.seccion_num || seccionNum(alumno.seccion),
      provincia: u.provincia || "",
      distrito: u.distrito || "",
      direccion: u.direccion || ""
    };
    NOTAS_KEYS.forEach(k => { registro[k] = alumno.notas[k] || ""; });
    if (!salida[alumno.seccion]) salida[alumno.seccion] = [];
    salida[alumno.seccion].push(registro);
  });

  descargar(
    "alumnos_con_distrito_y_direccion.json",
    JSON.stringify(salida, null, 2),
    "application/json;charset=utf-8"
  );
  avisar("JSON exportado con provincia, distrito y dirección.");
}

function exportarCSV() {
  const esc = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
  const cabecera = ["Alumno", "Seccion", "Grado", "Fila"].concat(NOTAS_KEYS, ["Provincia", "Distrito", "Direccion"]);
  const filas = ESTADO.filtrados.map(a => {
    const u = ubicacionDe(a);
    return [a.nombre, a.seccion, etiquetaGrado(a.grado) + (a.letra ? " " + a.letra : ""), a.fila]
      .concat(NOTAS_KEYS.map(k => a.notas[k]))
      .concat([u.provincia, u.distrito, u.direccion]);
  });
  const csv = "\ufeff" + [cabecera].concat(filas).map(f => f.map(esc).join(";")).join("\r\n");
  descargar("alumnos_filtrados.csv", csv, "text/csv;charset=utf-8");
}

const FILLS_NIVEL = { prim: "FFEEF3FF", sec: "FFEAFAF3", ini: "FFFDF0F6" };

function fechaCorta() {
  const d = new Date();
  return String(d.getDate()).padStart(2, "0") + "/" +
    String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
}

function marcaTiempo() {
  const d = new Date();
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}

function valorNota(valor) {
  if (valor === "" || valor == null) return "";
  const n = Number(valor);
  return isNaN(n) ? valor : n;
}

function descripcionFiltros() {
  const partes = [];
  const disponibles = gradosDisponibles();
  if (ESTADO.gradosSel === null) {
    partes.push("Todos los grados");
  } else {
    const elegidos = disponibles.filter(g => ESTADO.gradosSel.has(g));
    partes.push(elegidos.length ? elegidos.map(etiquetaGrado).join(", ") : "Sin grados seleccionados");
  }

  const selSeccion = document.getElementById("f-seccion");
  if (!selSeccion.disabled && selSeccion.value !== "todas") partes.push("Sección " + selSeccion.value);

  const q = document.getElementById("f-buscar").value.trim();
  if (q) partes.push("Búsqueda: \"" + q + "\"");

  const prov = document.getElementById("f-provincia").value;
  if (prov !== "todas") partes.push("Provincia: " + prov);

  const dist = document.getElementById("f-distrito").value;
  if (dist !== "todos") partes.push("Distrito: " + dist);

  return partes.join("   ·   ");
}

function exportarExcel() {
  if (typeof ExcelJS === "undefined") {
    avisar("No se pudo cargar el generador de Excel. Se descarga un CSV equivalente.", true);
    exportarCSV();
    return;
  }

  const totalCols = 8 + NOTAS_KEYS.length;
  const libro = new ExcelJS.Workbook();
  libro.creator = "Distrito de Estudiantes";
  libro.lastModifiedBy = "Distrito de Estudiantes";
  libro.created = new Date();
  libro.modified = new Date();

  const hoja = libro.addWorksheet("Seguimiento académico", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 4 }],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: "3:4",
      horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
    }
  });

  const anchos = [6, 34, 18, 11, 8, 16, 20, 32];
  NOTAS_KEYS.forEach(() => anchos.push(6));
  anchos.forEach((w, i) => { hoja.getColumn(i + 1).width = w; });

  const bordeFino = {
    top: { style: "thin", color: { argb: "FFD6DEEB" } },
    left: { style: "thin", color: { argb: "FFD6DEEB" } },
    bottom: { style: "thin", color: { argb: "FFD6DEEB" } },
    right: { style: "thin", color: { argb: "FFD6DEEB" } }
  };

  hoja.mergeCells(1, 1, 1, totalCols);
  const titulo = hoja.getCell(1, 1);
  titulo.value = "DISTRITO DE ESTUDIANTES · REPORTE DE SEGUIMIENTO ACADÉMICO";
  titulo.font = { name: "Calibri", size: 15, bold: true, color: { argb: "FFFFFFFF" } };
  titulo.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  titulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF16305F" } };
  hoja.getRow(1).height = 28;

  hoja.mergeCells(2, 1, 2, totalCols);
  const subtitulo = hoja.getCell(2, 1);
  subtitulo.value = "Generado el " + fechaCorta() + "   ·   " +
    ESTADO.filtrados.length + " de " + ESTADO.alumnos.length + " alumnos   ·   Filtros: " + descripcionFiltros();
  subtitulo.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF5A6B85" } };
  subtitulo.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  subtitulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F5FB" } };
  hoja.getRow(2).height = 18;

  hoja.mergeCells(3, 1, 3, 8);
  const grupoA = hoja.getCell(3, 1);
  grupoA.value = "DATOS DEL ALUMNO Y UBICACIÓN DE ORIGEN";
  hoja.mergeCells(3, 9, 3, totalCols);
  const grupoB = hoja.getCell(3, 9);
  grupoB.value = "CALIFICACIONES (B–M)";
  [grupoA, grupoB].forEach(celda => {
    celda.font = { name: "Calibri", size: 10.5, bold: true, color: { argb: "FFFFFFFF" } };
    celda.alignment = { vertical: "middle", horizontal: "center" };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2B5CA8" } };
    celda.border = bordeFino;
  });
  hoja.getRow(3).height = 20;

  const cabeceras = ["N°", "Alumno", "Grado", "Sección", "Fila", "Provincia", "Distrito de origen", "Dirección / referencia"]
    .concat(NOTAS_KEYS);
  cabeceras.forEach((texto, i) => {
    const celda = hoja.getCell(4, i + 1);
    celda.value = texto;
    celda.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    celda.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F5FD6" } };
    celda.border = bordeFino;
  });
  hoja.getRow(4).height = 22;

  ESTADO.filtrados.forEach((a, i) => {
    const u = ubicacionDe(a);
    const fila = hoja.addRow([
      i + 1,
      a.nombre,
      etiquetaGrado(a.grado),
      a.letra ? a.letra : "—",
      Number(a.fila) || a.fila,
      u.provincia || "Sin asignar",
      u.distrito || "Sin asignar",
      u.direccion || ""
    ].concat(NOTAS_KEYS.map(k => valorNota(a.notas[k]))));

    fila.height = 18;
    fila.eachCell({ includeEmpty: true }, (celda, col) => {
      celda.border = bordeFino;
      celda.font = { name: "Calibri", size: 11, color: { argb: "FF17233B" } };
      celda.alignment = { vertical: "middle" };
      if (i % 2 === 1) {
        celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F8FD" } };
      }
    });

    [1, 4, 5].concat(NOTAS_KEYS.map((_, n) => 9 + n)).forEach(col => {
      fila.getCell(col).alignment = { vertical: "middle", horizontal: "center" };
    });

    const rellenoNivel = FILLS_NIVEL[NIVEL_GRADO[a.grado]];
    if (rellenoNivel) {
      const cg = fila.getCell(3);
      cg.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rellenoNivel } };
      cg.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF17233B" } };
    }

    [6, 7].forEach(col => {
      const celda = fila.getCell(col);
      if (celda.value === "Sin asignar") {
        celda.font = { name: "Calibri", size: 11, italic: true, color: { argb: "FFB26A00" } };
      }
    });
  });

  if (ESTADO.filtrados.length > 0) {
    hoja.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: 4 + ESTADO.filtrados.length, column: totalCols }
    };
  }

  const nombreArchivo = "reporte_alumnos_" + marcaTiempo() + ".xlsx";
  libro.xlsx.writeBuffer().then(buffer => {
    descargar(nombreArchivo, buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    avisar("Excel exportado ✓ " + ESTADO.filtrados.length + " alumnos con formato de reporte.");
  }).catch(err => {
    avisar("No se pudo generar el Excel: " + err.message, true);
  });
}

function importarJSON(file) {
  const lector = new FileReader();
  lector.onload = () => {
    try {
      const datos = JSON.parse(lector.result);
      let asignados = 0;
      let nuevosAgregados = 0;

      const registrar = (reg, seccionPorDefecto) => {
        const seccion = reg.seccion || seccionPorDefecto;
        if (!seccion) return;
        const id = idDe({ seccion, fila: reg.fila });

        if (!ESTADO.alumnos.some(a => a.id === id)) {
          const notas = {};
          NOTAS_KEYS.forEach(k => { notas[k] = reg[k] == null ? "" : String(reg[k]); });
          const { grado, letra } = parseSeccion(seccion);
          ESTADO.nuevos.push(completarNuevo({
            id,
            nombre: reg.nombre,
            fila: reg.fila,
            seccion,
            grado,
            letra,
            seccion_num: reg.seccion_num,
            notas
          }));
          nuevosAgregados++;
        }

        const provincia = reg.provincia || "";
        const distrito = reg.distrito || "";
        const direccion = reg.direccion || "";
        if (!provincia && !distrito && !direccion) return;
        const previo = ESTADO.ubicaciones[id] || {};
        ESTADO.ubicaciones[id] = {
          provincia: provincia || previo.provincia || "",
          distrito: distrito || previo.distrito || "",
          direccion: direccion || previo.direccion || ""
        };
        asignados++;
      };

      if (Array.isArray(datos)) {
        datos.forEach(reg => registrar(reg, null));
      } else {
        Object.keys(datos).forEach(seccion => {
          const bloques = datos[seccion];
          if (Array.isArray(bloques)) bloques.forEach(reg => registrar(reg, seccion));
        });
      }

      if (nuevosAgregados > 0) guardarNuevos();
      reconstruirAlumnos();
      guardarUbicaciones();
      render();
      avisar("Importados " + asignados + " registros con distrito/dirección." +
        (nuevosAgregados > 0 ? " " + nuevosAgregados + " alumnos nuevos agregados." : ""));
    } catch (e) {
      avisar("Archivo no válido: " + e.message, true);
    }
  };
  lector.readAsText(file, "utf-8");
}

/* ---------------- Agregar alumno ---------------- */

function mostrarErrorModal(mensaje) {
  const el = document.getElementById("modal-error");
  el.textContent = mensaje;
  el.hidden = false;
}

function opcionesGradoModal() {
  const sel = document.getElementById("n-grado");
  sel.innerHTML = "";

  const vacio = document.createElement("option");
  vacio.value = "";
  vacio.textContent = "Seleccione el grado";
  sel.appendChild(vacio);

  const niveles = [
    ["prim", "Primaria (1° a 6°)"],
    ["sec", "Secundaria (1° a 5°)"],
    ["ini", "Inicial (3 a 5 años)"]
  ];

  niveles.forEach(([nivel, texto]) => {
    const grupo = document.createElement("optgroup");
    grupo.label = texto;
    ORDEN_GRADOS
      .filter(g => NIVEL_GRADO[g] === nivel && ESTADO.alumnos.some(a => a.grado === g))
      .forEach(g => {
        const op = document.createElement("option");
        const cantidad = ESTADO.alumnos.filter(a => a.grado === g).length;
        op.value = g;
        op.textContent = etiquetaGrado(g) + " (" + cantidad + ")";
        grupo.appendChild(op);
      });
    if (grupo.children.length) sel.appendChild(grupo);
  });
}

function configurarModalBase(titulo, textoBoton) {
  const error = document.getElementById("modal-error");
  error.hidden = true;
  error.textContent = "";

  document.getElementById("modal-titulo").textContent = titulo;
  document.getElementById("btn-guardar-alumno").textContent = textoBoton;
  document.getElementById("modal-sub").textContent = ESTADO.editando
    ? "Edita el nombre, grado, sección y ubicación del alumno."
    : "Para alumnos que no están en el archivo JSON original.";

  opcionesGradoModal();

  const selProv = document.getElementById("n-provincia");
  opcionesProvincias(selProv, true);
  selProv.options[0].value = "";
  selProv.options[0].textContent = "— Seleccione provincia —";

  const selDist = document.getElementById("n-distrito");
  opcionesDistritos(selDist, "", false);
  selDist.value = "";
  selDist.disabled = true;
}

function abrirModal() {
  ESTADO.editando = null;
  configurarModalBase("Agregar alumno", "Agregar alumno");

  document.getElementById("n-nombre").value = "";
  document.getElementById("n-direccion").value = "";
  document.getElementById("n-grado").value = "";

  const selSeccion = document.getElementById("n-seccion");
  selSeccion.value = "";
  selSeccion.disabled = true;

  document.getElementById("n-provincia").value = "";

  document.getElementById("modal-agregar").hidden = false;
  document.getElementById("n-nombre").focus();
}

function abrirModalEdicion(alumno) {
  ESTADO.editando = alumno.id;
  configurarModalBase("Editar alumno", "Guardar cambios");

  document.getElementById("n-nombre").value = alumno.nombre;
  document.getElementById("n-grado").value = alumno.grado;

  const selSeccion = document.getElementById("n-seccion");
  const esSecundaria = alumno.grado.endsWith("SEC");
  selSeccion.disabled = !esSecundaria;
  selSeccion.value = esSecundaria ? (alumno.letra || "") : "";

  const u = ubicacionDe(alumno);
  const selProv = document.getElementById("n-provincia");
  const selDist = document.getElementById("n-distrito");

  if (u.provincia && UBIGEO_LIMA[u.provincia]) {
    selProv.value = u.provincia;
    opcionesDistritos(selDist, u.provincia, false);
    selDist.value = u.distrito || "";
    selDist.disabled = false;
  } else {
    selProv.value = "";
    selDist.value = "";
    selDist.disabled = true;
  }

  document.getElementById("n-direccion").value = u.direccion || "";

  document.getElementById("modal-agregar").hidden = false;
  document.getElementById("n-nombre").focus();
}

function cerrarModal() {
  ESTADO.editando = null;
  document.getElementById("modal-agregar").hidden = true;
}

function limpiarFiltros() {
  document.getElementById("f-buscar").value = "";
  ESTADO.gradosSel = null;
  document.getElementById("f-seccion").value = "todas";
  document.getElementById("f-seccion").disabled = true;
  document.getElementById("f-provincia").value = "todas";
  opcionesDistritos(document.getElementById("f-distrito"), "", true);
  document.getElementById("f-distrito").value = "todos";
  document.getElementById("f-distrito").disabled = true;
  document.getElementById("f-orden").value = "grado";
  cerrarPanelGrado();
  render();
}

function manejarAlta(evento) {
  evento.preventDefault();

  const nombre = document.getElementById("n-nombre").value.trim().replace(/\s+/g, " ");
  const grado = document.getElementById("n-grado").value;
  const letra = grado.endsWith("SEC") ? document.getElementById("n-seccion").value : "";

  if (!nombre) return mostrarErrorModal("Escribe el nombre completo del alumno.");
  if (!grado) return mostrarErrorModal("Selecciona el grado del alumno.");

  const seccion = construirSeccion(grado, letra);
  const provinciaSel = document.getElementById("n-provincia").value;
  const provincia = provinciaSel === "todas" ? "" : provinciaSel;
  const distrito = provincia ? document.getElementById("n-distrito").value : "";
  const direccion = document.getElementById("n-direccion").value.trim();

  let alumno;

  if (ESTADO.editando) {
    alumno = ESTADO.alumnos.find(a => a.id === ESTADO.editando);
    if (!alumno) {
      cerrarModal();
      return avisar("No se encontró el alumno a editar.", true);
    }

    if (alumno.esNuevo) {
      const original = ESTADO.nuevos.find(n => n.id === alumno.id);
      original.nombre = nombre;
      original.seccion = seccion;
      original.grado = grado;
      original.letra = letra;
      guardarNuevos();
    } else {
      ESTADO.ediciones[alumno.id] = { nombre, seccion };
      guardarEdiciones();
    }

    ESTADO.ubicaciones[alumno.id] = { provincia, distrito, direccion };
    guardarUbicaciones();

    reconstruirAlumnos();
    cerrarModal();
    render();

    const actualizado = ESTADO.alumnos.find(a => a.id === alumno.id);
    if (actualizado && !ESTADO.filtrados.some(a => a.id === actualizado.id)) limpiarFiltros();

    avisar("Cambios guardados ✓ " + nombre + " (" + etiquetaGrado(grado) + (letra ? " · " + letra : "") + ")");
    return;
  }

  const fila = siguienteFila(seccion);

  alumno = completarNuevo({
    id: seccion + "|" + fila,
    nombre,
    fila,
    seccion,
    grado,
    letra,
    seccion_num: seccionNum(seccion),
    notas: {}
  });

  ESTADO.nuevos.push(alumno);
  guardarNuevos();

  if (provincia || distrito || direccion) {
    ESTADO.ubicaciones[alumno.id] = { provincia, distrito, direccion };
    guardarUbicaciones();
  }

  reconstruirAlumnos();
  cerrarModal();
  render();

  if (!ESTADO.filtrados.some(a => a.id === alumno.id)) limpiarFiltros();

  avisar("Alumno agregado ✓ " + alumno.nombre + " (" + etiquetaGrado(grado) + (letra ? " · " + letra : "") + ")");
}

function deshacerEdicion(alumno) {
  const seguro = window.confirm("¿Restaurar los datos originales de \"" + alumno.nombre + "\"?");
  if (!seguro) return;

  delete ESTADO.ediciones[alumno.id];
  guardarEdiciones();
  reconstruirAlumnos();
  render();
  avisar("Datos originales restaurados.");
}

function eliminarNuevo(alumno) {
  const seguro = window.confirm("¿Eliminar al alumno \"" + alumno.nombre + "\"?");
  if (!seguro) return;

  ESTADO.nuevos = ESTADO.nuevos.filter(n => n.id !== alumno.id);
  delete ESTADO.ubicaciones[alumno.id];
  guardarNuevos();
  guardarUbicaciones();
  reconstruirAlumnos();
  render();
  avisar("Alumno eliminado: " + alumno.nombre);
}

/* ---------------- Eventos ---------------- */

function vincularEventos() {
  const rerender = () => render();

  document.getElementById("f-buscar").addEventListener("input", rerender);

  const msGrado = document.getElementById("ms-grado");
  const btnGrado = document.getElementById("f-grado-btn");
  const panelGrado = document.getElementById("f-grado-panel");

  btnGrado.addEventListener("click", e => {
    e.stopPropagation();
    const abrir = panelGrado.hidden;
    panelGrado.hidden = !abrir;
    btnGrado.setAttribute("aria-expanded", String(abrir));
    msGrado.classList.toggle("abierto", abrir);
  });

  panelGrado.addEventListener("change", e => {
    if (e.target.classList && e.target.classList.contains("ms-check")) aplicarSeleccionGrados();
  });

  panelGrado.addEventListener("click", e => {
    const accion = e.target.getAttribute && e.target.getAttribute("data-accion");
    if (!accion) return;
    e.preventDefault();
    document.querySelectorAll("#f-grado-panel .ms-check").forEach(chk => {
      chk.checked = accion === "todos";
    });
    aplicarSeleccionGrados();
  });

  document.addEventListener("click", e => {
    if (!msGrado.contains(e.target)) cerrarPanelGrado();
  });

  document.getElementById("f-seccion").addEventListener("change", rerender);
  document.getElementById("f-orden").addEventListener("change", rerender);

  document.getElementById("f-provincia").addEventListener("change", e => {
    const selDist = document.getElementById("f-distrito");
    const valor = e.target.value;
    if (valor === "todas") {
      opcionesDistritos(selDist, "", true);
      selDist.value = "todos";
      selDist.disabled = true;
    } else {
      opcionesDistritos(selDist, valor, true);
      selDist.value = "todos";
    }
    rerender();
  });

  document.getElementById("f-distrito").addEventListener("change", rerender);

  document.getElementById("btn-limpiar").addEventListener("click", limpiarFiltros);

  document.getElementById("btn-export-json").addEventListener("click", exportarJSON);
  document.getElementById("btn-export-xlsx").addEventListener("click", exportarExcel);
  document.getElementById("btn-print").addEventListener("click", () => window.print());

  document.getElementById("file-import").addEventListener("change", e => {
    const file = e.target.files && e.target.files[0];
    if (file) importarJSON(file);
    e.target.value = "";
  });

  document.getElementById("btn-agregar").addEventListener("click", abrirModal);
  document.getElementById("btn-cancelar").addEventListener("click", cerrarModal);
  document.getElementById("form-agregar").addEventListener("submit", manejarAlta);

  document.getElementById("modal-agregar").addEventListener("click", e => {
    if (e.target.id === "modal-agregar") cerrarModal();
  });

  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    cerrarPanelGrado();
    if (!document.getElementById("modal-agregar").hidden) cerrarModal();
  });

  document.getElementById("n-grado").addEventListener("change", e => {
    const esSecundaria = e.target.value.endsWith("SEC");
    const selSeccion = document.getElementById("n-seccion");
    selSeccion.disabled = !esSecundaria;
    if (!esSecundaria) selSeccion.value = "";
  });

  document.getElementById("n-provincia").addEventListener("change", e => {
    const selDist = document.getElementById("n-distrito");
    const valor = e.target.value;
    if (!valor || valor === "todas") {
      opcionesDistritos(selDist, "", false);
      selDist.value = "";
      selDist.disabled = true;
    } else {
      opcionesDistritos(selDist, valor, false);
      selDist.value = "";
      selDist.disabled = false;
    }
  });
}

/* ---------------- Inicio ---------------- */

function iniciar() {
  if (ESTADO.alumnos.length > 0) return;

  if (typeof ALUMNOS_DATA === "undefined") {
    document.body.innerHTML = "<p style='padding:30px;font-family:sans-serif'>No se encontró js/alumnos_data.js</p>";
    return;
  }

  cargarUbicaciones();
  cargarNuevos();
  cargarEdiciones();
  reconstruirAlumnos();

  opcionesProvincias(document.getElementById("f-provincia"), true);
  opcionesDistritos(document.getElementById("f-distrito"), "", true);
  document.getElementById("f-distrito").disabled = true;
  popularGrados();

  vincularEventos();
  render();
  avisar(ESTADO.alumnos.length + " alumnos cargados correctamente." +
    (ESTADO.nuevos.length > 0 ? " (" + ESTADO.nuevos.length + " agregados manualmente)" : ""));
}

document.addEventListener("DOMContentLoaded", iniciar);
