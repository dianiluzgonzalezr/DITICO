// 1. Configuración de Supabase
const SUPABASE_URL = 'https://xdwtgtxeiksxemmpkfkk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhkd3RndHhlaWtzeGVtbXBrZmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MjIwMTQsImV4cCI6MjEwMjM5ODAxNH0.aWq8B2FIr1PJJN7Dg9EpRMOVIuYdajacuujEg3lTjsQ';

// 2. Variables Globales del Sistema
let productosGlobales = [];
let categoriasGlobales = [];
let cantidadesSeleccionadas = {};
let carrito = {};
let tasaBCV = 771.00;
let categoriaActiva = "Todos";
let busquedaTexto = "";
let imagenSubidaUrl = "";
let pasoActualCarrito = 1;

// 3. Inicialización del Cliente de Supabase
const { createClient } = window.supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Inicialización de la Aplicación
document.addEventListener("DOMContentLoaded", async () => {
    cargarTasaBCV();
    cargarCategorias();
    cargarProductos();
    configurarDropZone();
    cargarCarritoDeStorage();

    document.getElementById('form-login')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = document.getElementById('login-email')?.value.trim();
        const password = document.getElementById('login-password')?.value || '';
        await iniciarSesionAdmin(email, password);
    });

    _supabase.auth.onAuthStateChange((_event, session) => {
        if (!session) salirDeAdminVisualmente();
    });

    window.addEventListener('hashchange', verificarRutaAdmin);
    await verificarRutaAdmin();
});

/* ==========================================================================
   ADMINISTRACIÓN Y AUTENTICACIÓN
   ========================================================================== */

async function comprobarAdministrador() {
    const { data: sessionData } = await _supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) return { autorizado: false, user: null };

    const { data, error } = await _supabase.rpc('es_admin');
    return { autorizado: !error && data === true, user };
}

async function verificarRutaAdmin() {
    const esRutaAdmin = window.location.hash.toLowerCase() === '#admin';

    if (!esRutaAdmin) {
        salirDeAdminVisualmente();
        cerrarLogin();
        return;
    }

    const { autorizado, user } = await comprobarAdministrador();
    if (autorizado) {
        activarModoAdmin(user);
    } else {
        salirDeAdminVisualmente();
        abrirLogin();
    }
}

function activarModoAdmin(user) {
    document.body.classList.add('admin-mode');
    const toolbar = document.getElementById('admin-toolbar');
    const panelTasa = document.getElementById('admin-tasa-panel');
    const label = document.getElementById('admin-user-label');
    if (toolbar) toolbar.style.display = 'flex';
    if (panelTasa) panelTasa.style.display = 'block';
    if (label) label.textContent = `Administrador: ${user?.email || 'sesión activa'}`;
    cerrarLogin();
}

function salirDeAdminVisualmente() {
    document.body.classList.remove('admin-mode');
    const toolbar = document.getElementById('admin-toolbar');
    const panelTasa = document.getElementById('admin-tasa-panel');
    if (toolbar) toolbar.style.display = 'none';
    if (panelTasa) panelTasa.style.display = 'none';
}

function abrirLogin() {
    const modal = document.getElementById('modal-login');
    if (!modal) return;
    modal.style.display = 'block';
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => document.getElementById('login-email')?.focus(), 50);
}

function cerrarLogin() {
    const modal = document.getElementById('modal-login');
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
}

async function iniciarSesionAdmin(email, password) {
    const boton = document.getElementById('btn-login');
    const errorEl = document.getElementById('login-error');
    if (errorEl) errorEl.textContent = '';

    if (!email || !password) {
        if (errorEl) errorEl.textContent = 'Completa el correo y la contraseña.';
        return;
    }

    if (boton) {
        boton.disabled = true;
        boton.dataset.textoOriginal = boton.textContent;
        boton.textContent = 'Verificando...';
    }

    const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
    if (error) {
        if (errorEl) errorEl.textContent = traducirErrorAuth(error.message);
        if (boton) {
            boton.disabled = false;
            boton.textContent = boton.dataset.textoOriginal || 'Iniciar sesión';
        }
        return;
    }

    const resultado = await comprobarAdministrador();
    if (!resultado.autorizado) {
        await _supabase.auth.signOut();
        if (errorEl) errorEl.textContent = 'El usuario inició sesión, pero no está registrado como administrador.';
        if (boton) {
            boton.disabled = false;
            boton.textContent = boton.dataset.textoOriginal || 'Iniciar sesión';
        }
        return;
    }

    activarModoAdmin(data.user);
    mostrarToast('Acceso administrativo autorizado', 'success');
    if (boton) {
        boton.disabled = false;
        boton.textContent = boton.dataset.textoOriginal || 'Iniciar sesión';
    }
}

async function cerrarSesionAdmin() {
    await _supabase.auth.signOut();
    salirDeAdminVisualmente();
    cerrarModal();
    cerrarLogin();
    if (window.location.hash === '#admin') history.replaceState(null, '', window.location.pathname + window.location.search);
    mostrarToast('Sesión administrativa cerrada', 'success');
}

function traducirErrorAuth(message = '') {
    if (message.toLowerCase().includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
    if (message.toLowerCase().includes('email not confirmed')) return 'Debes confirmar el correo antes de iniciar sesión.';
    return `No se pudo iniciar sesión: ${message}`;
}

function generarReferenciaUnica() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `REF-${code}`;
}

/* ==========================================================================
   GESTIÓN DE TASA BCV
   ========================================================================== */

async function cargarTasaBCV() {
    try {
        const { data } = await _supabase
            .from('configuracion')
            .select('valor')
            .eq('clave', 'tasa_bcv')
            .maybeSingle();

        if (data && data.valor) {
            tasaBCV = parseFloat(data.valor);
            const elTexto = document.getElementById('texto-tasa-bcv');
            if (elTexto) elTexto.innerText = `Tasa: Bs ${tasaBCV.toFixed(2)}`;
            const inputTasa = document.getElementById('input-nueva-tasa');
            if (inputTasa) inputTasa.value = tasaBCV.toFixed(2);
        }
    } catch (e) {
        console.warn("No se pudo cargar la tasa de la BD, usando valor por defecto:", tasaBCV);
    }
}

async function actualizarTasaBCV() {
    const inputTasa = document.getElementById('input-nueva-tasa');
    const nuevaTasa = parseFloat(inputTasa ? inputTasa.value : 0);
    if (!nuevaTasa || nuevaTasa <= 0) return mostrarToast("Ingresa una tasa válida", "error");

    const { error } = await _supabase.from('configuracion').upsert({ clave: 'tasa_bcv', valor: nuevaTasa }, { onConflict: 'clave' });
    if (!error) {
        tasaBCV = nuevaTasa;
        const elTexto = document.getElementById('texto-tasa-bcv');
        if (elTexto) elTexto.innerText = `Tasa: Bs ${tasaBCV.toFixed(2)}`;
        mostrarToast("Tasa BCV actualizada correctamente", "success");
        renderizarProductos();
        actualizarCarritoUI();
    } else {
        mostrarToast("Error al actualizar la tasa", "error");
    }
}

/* ==========================================================================
   CATEGORÍAS Y BÚSQUEDA
   ========================================================================== */

async function cargarCategorias() {
    const { data, error } = await _supabase.from('productos').select('categoria');
    if (data && !error) {
        const catsSet = new Set(data.map(p => p.categoria).filter(Boolean));
        categoriasGlobales = Array.from(catsSet);
        renderizarCategoriasNav();
        poblarCategoriasSelect();
    }
}

function renderizarCategoriasNav() {
    const nav = document.getElementById('menu-categorias');
    if (!nav) return;
    nav.innerHTML = `<button onclick="filtrarCategoria('Todos')" class="btn-cat-filtro ${categoriaActiva === 'Todos' ? 'active' : ''}">Todos</button>`;
    categoriasGlobales.forEach(cat => {
        nav.innerHTML += `<button onclick="filtrarCategoria('${cat}')" class="btn-cat-filtro ${categoriaActiva === cat ? 'active' : ''}">${cat}</button>`;
    });
}

function poblarCategoriasSelect() {
    const select = document.getElementById('nuevo-categoria');
    if (!select) return;
    select.innerHTML = '';
    categoriasGlobales.forEach(cat => {
        select.innerHTML += `<option value="${cat}">${cat}</option>`;
    });
}

function filtrarCategoria(cat) {
    categoriaActiva = cat;
    renderizarCategoriasNav();
    renderizarProductos();
}

function buscarProductos(texto) {
    busquedaTexto = texto.toLowerCase().trim();
    renderizarProductos();
}

/* ==========================================================================
   RENDERIZADO DE PRODUCTOS (CATÁLOGO)
   ========================================================================== */

async function cargarProductos() {
    const { data, error } = await _supabase.from('productos').select('*').order('destacado', { ascending: false });
    if (error) {
        mostrarToast("Error al obtener productos", "error");
        return;
    }
    productosGlobales = data || [];
    renderizarProductos();
}

function renderizarProductos() {
    const contenedor = document.getElementById('contenedor-productos');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    const filtrados = productosGlobales.filter(prod => {
        const coincideCat = categoriaActiva === "Todos" || prod.categoria === categoriaActiva;
        const coincideBusqueda = !busquedaTexto || 
            (prod.nombre && prod.nombre.toLowerCase().includes(busquedaTexto)) || 
            (prod.referencia && prod.referencia.toLowerCase().includes(busquedaTexto));
        return coincideCat && coincideBusqueda;
    });

    if (filtrados.length === 0) {
        contenedor.innerHTML = '<p style="text-align:center; grid-column:1/-1; padding:30px; color:#888;">No se encontraron productos.</p>';
        return;
    }

    filtrados.forEach(prod => {
        const cant = cantidadesSeleccionadas[prod.id] || 1;
        const esMayorista = prod.cant_min_mayorista > 0 && cant >= prod.cant_min_mayorista;
        const precioAplicado = esMayorista ? (prod.precio_mayorista || prod.precio) : prod.precio;
        const precioBs = (precioAplicado * tasaBCV).toFixed(2);

        const card = document.createElement('div');
        card.className = `card ${prod.agotado ? 'agotado' : ''}`;
        
        card.innerHTML = `
            <span class="badge-ref">${prod.referencia || 'SIN-REF'}</span>
            ${prod.destacado ? '<span class="badge-destacado">⭐ Destacado</span>' : ''}
            <img src="${prod.imagen_url || 'https://via.placeholder.com/300'}" alt="${prod.nombre}">
            
            <h3>${prod.nombre}</h3>
            <div class="ref-texto">Ref: ${prod.referencia || 'N/A'}</div>

            ${prod.agotado ? '<span class="badge-agotado">🚫 AGOTADO</span>' : ''}

            ${esMayorista ? '<span style="color:#2ed573; font-size:0.85rem; font-weight:bold;">¡Precio Mayorista Aplicado!</span>' : ''}
            <div class="precio-usd">$${Number(precioAplicado).toFixed(2)}</div>
            <div class="precio-bs">Bs ${precioBs}</div>
            
            ${prod.cant_min_mayorista > 0 ? `
                <div class="info-mayorista-badge">
                    Mayorista (${prod.cant_min_mayorista}+ unids): $${Number(prod.precio_mayorista).toFixed(2)}
                </div>
            ` : ''}

            <div class="admin-card-controls">
                <button class="btn-editar-card">✏️ Editar</button>
                <button class="btn-toggle-agotado">
                    ${prod.agotado ? '✅ Disponible' : '🚫 Agotado'}
                </button>
                <button class="btn-eliminar-card">🗑️</button>
            </div>

            <div class="selector-cantidad" style="display:flex; align-items:center; justify-content:center; gap:6px;">
                <button class="btn-restar-cant" ${prod.agotado ? 'disabled' : ''}>-</button>
                <input type="number" class="input-cant-card" value="${cant}" min="1" ${prod.agotado ? 'disabled' : ''} style="width:50px; text-align:center; padding:4px; font-weight:bold; border:1px solid #ccc; border-radius:6px;">
                <button class="btn-sumar-cant" ${prod.agotado ? 'disabled' : ''}>+</button>
            </div>
            
            <button class="btn-agregar" ${prod.agotado ? 'disabled' : ''} style="margin-top:10px;">
                ${prod.agotado ? 'Agotado' : 'Agregar al Carrito'}
            </button>
        `;

        // Eventos Admin
        card.querySelector('.btn-editar-card').onclick = () => prepararEdicion(prod);
        card.querySelector('.btn-toggle-agotado').onclick = () => toggleAgotado(prod.id, !prod.agotado);
        card.querySelector('.btn-eliminar-card').onclick = () => eliminarProducto(prod.id);

        // Eventos Selector Cantidad Tarjeta
        card.querySelector('.btn-restar-cant').onclick = () => cambiarCantidadSeleccionada(prod.id, -1);
        card.querySelector('.btn-sumar-cant').onclick = () => cambiarCantidadSeleccionada(prod.id, 1);
        
        const inputCantCard = card.querySelector('.input-cant-card');
        inputCantCard.onchange = (e) => actualizarCantidadSeleccionadaDirecta(prod.id, e.target.value);

        // Agregar al Carrito
        card.querySelector('.btn-agregar').onclick = () => agregarAlCarrito(prod);

        contenedor.appendChild(card);
    });
}

function cambiarCantidadSeleccionada(id, cambio) {
    const actual = cantidadesSeleccionadas[id] || 1;
    cantidadesSeleccionadas[id] = Math.max(1, actual + cambio);
    renderizarProductos();
}

function actualizarCantidadSeleccionadaDirecta(id, valor) {
    const num = parseInt(valor, 10);
    cantidadesSeleccionadas[id] = (isNaN(num) || num < 1) ? 1 : num;
    renderizarProductos();
}

async function toggleAgotado(id, nuevoEstado) {
    const { error } = await _supabase.from('productos').update({ agotado: nuevoEstado }).eq('id', id);
    if (!error) {
        mostrarToast(nuevoEstado ? "Producto marcado como Agotado" : "Producto marcado como Disponible", "success");
        cargarProductos();
    } else {
        mostrarToast("Error al actualizar estado", "error");
    }
}

/* ==========================================================================
   CARRITO DE COMPRAS Y LOCAL STORAGE (EN 2 PASOS)
   ========================================================================== */

function agregarAlCarrito(prod) {
    if (prod.agotado) return mostrarToast("Producto agotado", "error");
    const cant = cantidadesSeleccionadas[prod.id] || 1;
    if (carrito[prod.id]) {
        carrito[prod.id].cantidad += cant;
    } else {
        carrito[prod.id] = { producto: prod, cantidad: cant };
    }
    cantidadesSeleccionadas[prod.id] = 1;
    renderizarProductos();
    actualizarCarritoUI();
    mostrarToast(`Añadido: ${prod.nombre}`, "success");
}

function cambiarCantidadCarrito(id, cambio) {
    if (carrito[id]) {
        carrito[id].cantidad += cambio;
        if (carrito[id].cantidad <= 0) {
            delete carrito[id];
        }
        actualizarCarritoUI();
    }
}

function actualizarCantidadCarritoDirecta(id, valor) {
    const num = parseInt(valor, 10);
    if (carrito[id]) {
        carrito[id].cantidad = (isNaN(num) || num < 1) ? 1 : num;
        actualizarCarritoUI();
    }
}

function eliminarItemCarrito(id) {
    if (carrito[id]) {
        delete carrito[id];
        actualizarCarritoUI();
        mostrarToast("Producto eliminado del carrito", "success");
    }
}

function vaciarCarrito() {
    carrito = {};
    actualizarCarritoUI();
    irAlPaso(1);
    mostrarToast("Carrito vaciado", "success");
}

function guardarCarritoEnStorage() {
    try {
        localStorage.setItem('carrito_ditico', JSON.stringify(carrito));
    } catch (e) {
        console.warn("No se pudo guardar el carrito en LocalStorage", e);
    }
}

function cargarCarritoDeStorage() {
    try {
        const data = localStorage.getItem('carrito_ditico');
        if (data) {
            carrito = JSON.parse(data);
            actualizarCarritoUI();
        }
    } catch (e) {
        console.warn("Error al cargar el carrito de LocalStorage", e);
    }
}

function irAlPaso(paso) {
    const paso1 = document.getElementById('paso-1-carrito');
    const paso2 = document.getElementById('paso-2-carrito');
    const titulo = document.getElementById('titulo-paso-carrito');

    if (paso === 2) {
        if (Object.keys(carrito).length === 0) {
            return mostrarToast("El carrito está vacío", "error");
        }
        if (paso1) paso1.style.display = 'none';
        if (paso2) paso2.style.display = 'flex';
        if (titulo) titulo.innerText = "📍 Datos y Pago (Paso 2 de 2)";
        pasoActualCarrito = 2;
    } else {
        if (paso2) paso2.style.display = 'none';
        if (paso1) paso1.style.display = 'flex';
        if (titulo) titulo.innerText = "🛒 Mi Carrito (Paso 1 de 2)";
        pasoActualCarrito = 1;
    }
}

function togglePanelCarrito() {
    const panel = document.getElementById('panel-carrito');
    if (panel) {
        panel.classList.toggle('activo');
        if (panel.classList.contains('activo')) {
            irAlPaso(1);
        }
    }
}

function actualizarCarritoUI() {
    const lista = document.getElementById('lista-carrito-items');
    const contador = document.getElementById('contador-carrito');
    const contenedorTotales = document.getElementById('resumen-totales-carrito');
    const contenedorTotalesFinal = document.getElementById('resumen-totales-final');
    if (!lista || !contador) return;

    lista.innerHTML = '';
    let totalUSD = 0;
    let totalItems = 0;

    const keys = Object.keys(carrito);

    if (keys.length === 0) {
        lista.innerHTML = '<p style="text-align:center; padding:30px; color:#888;">El carrito está vacío</p>';
        irAlPaso(1);
    } else {
        keys.forEach(id => {
            const item = carrito[id];
            const prod = item.producto;
            const cant = item.cantidad;

            const esMayorista = prod.cant_min_mayorista > 0 && cant >= prod.cant_min_mayorista;
            const precioUnitario = esMayorista ? (prod.precio_mayorista || prod.precio) : prod.precio;
            const subtotalUSD = precioUnitario * cant;

            totalUSD += subtotalUSD;
            totalItems += cant;

            const div = document.createElement('div');
            div.className = 'item-carrito';
            
            div.innerHTML = `
                <div class="item-carrito-info" style="flex:1;">
                    <h4 style="margin:0 0 4px 0;">${prod.nombre} ${esMayorista ? '🏷️ (May)' : ''}</h4>
                    <p style="margin:0; font-size:0.8rem; color:#666;">Ref: ${prod.referencia || 'N/A'}</p>
                    <p style="margin:0; font-size:0.88rem;">$${Number(precioUnitario).toFixed(2)} x ${cant} = <b>$${subtotalUSD.toFixed(2)}</b></p>
                </div>

                <div class="selector-cantidad" style="display:flex; align-items:center; gap:4px;">
                    <button class="btn-restar-cart">-</button>
                    <input type="number" class="input-cant-cart" value="${cant}" min="1" style="width:40px; text-align:center; padding:2px; border:1px solid #ccc; border-radius:4px; font-weight:bold;">
                    <button class="btn-sumar-cart">+</button>
                </div>

                <button class="btn-eliminar-item" title="Quitar producto" style="background:none; border:none; color:#ff4757; font-size:1.2rem; cursor:pointer; padding:0 4px; font-weight:bold;">&times;</button>
            `;

            div.querySelector('.btn-restar-cart').onclick = () => cambiarCantidadCarrito(id, -1);
            div.querySelector('.btn-sumar-cart').onclick = () => cambiarCantidadCarrito(id, 1);
            div.querySelector('.input-cant-cart').onchange = (e) => actualizarCantidadCarritoDirecta(id, e.target.value);
            div.querySelector('.btn-eliminar-item').onclick = () => eliminarItemCarrito(id);

            lista.appendChild(div);
        });
    }

    const totalBS = totalUSD * tasaBCV;
    contador.innerText = totalItems;

    const htmlTotales = `
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>Subtotal USD:</span> <b>$${totalUSD.toFixed(2)}</b></div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>Total estimado Bs:</span> <b>Bs ${totalBS.toFixed(2)}</b></div>
    `;

    if (contenedorTotales) {
        contenedorTotales.innerHTML = htmlTotales + (keys.length > 0 ? '<button onclick="vaciarCarrito()" style="width:100%; background:#ff4757; color:white; border:none; padding:6px; border-radius:6px; cursor:pointer; font-weight:bold; margin-top:6px; font-size:0.8rem;">🗑️ Vaciar Carrito</button>' : '');
    }

    if (contenedorTotalesFinal) {
        contenedorTotalesFinal.innerHTML = htmlTotales;
    }

    guardarCarritoEnStorage();
}

/* ENVÍO DE PEDIDO A WHATSAPP */
function enviarPedidoWhatsApp() {
    const keys = Object.keys(carrito);
    if (keys.length === 0) return mostrarToast("Tu carrito está vacío", "error");

    const nombre = document.getElementById('cliente-nombre')?.value.trim();
    const telefono = document.getElementById('cliente-telefono')?.value.trim();
    const direccion = document.getElementById('cliente-direccion')?.value.trim();
    const selectPago = document.getElementById('metodo-pago-select');
    const metodoPago = selectPago ? selectPago.value : 'No especificado';

    if (!nombre || !telefono || !direccion) {
        return mostrarToast("Completa tu Nombre, Teléfono y Dirección", "error");
    }

    let mensaje = "🛒 *NUEVO PEDIDO DITICO*\n";
    mensaje += "----------------------------------\n";
    mensaje += `👤 *Cliente:* ${nombre}\n`;
    mensaje += `📞 *Teléfono:* ${telefono}\n`;
    mensaje += `📍 *Dirección:* ${direccion}\n`;
    mensaje += "----------------------------------\n";
    mensaje += "*DETALLE DEL PEDIDO:*\n\n";

    let totalUSD = 0;

    keys.forEach(id => {
        const item = carrito[id];
        const prod = item.producto;
        const cant = item.cantidad;

        const esMayorista = prod.cant_min_mayorista > 0 && cant >= prod.cant_min_mayorista;
        const precioUnitario = esMayorista ? (prod.precio_mayorista || prod.precio) : prod.precio;
        const subtotal = precioUnitario * cant;
        totalUSD += subtotal;

        mensaje += `• *${prod.nombre}*\n`;
        mensaje += `  - Ref: ${prod.referencia || 'N/A'}\n`;
        mensaje += `  - Cantidad: ${cant}\n`;
        mensaje += `  - Subtotal: $${subtotal.toFixed(2)} ${esMayorista ? '(Mayorista)' : ''}\n`;
        mensaje += `  - Imagen: ${prod.imagen_url || 'Sin imagen'}\n\n`;
    });

    const totalBs = totalUSD * tasaBCV;
    mensaje += "----------------------------------\n";
    mensaje += `💵 *Total USD:* $${totalUSD.toFixed(2)}\n`;
    mensaje += `🇻🇪 *Total Bs (Tasa ${tasaBCV.toFixed(2)}):* Bs ${totalBs.toFixed(2)}\n`;
    mensaje += `💳 *Método de Pago:* ${metodoPago}\n`;

    const url = `https://wa.me/584241191218?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');

    vaciarCarrito();
    togglePanelCarrito();
}

/* ==========================================================================
   MODAL DE ADMINISTRACIÓN DE PRODUCTOS
   ========================================================================== */

function abrirModal() {
    document.getElementById('edit-id').value = '';
    document.getElementById('modal-titulo').innerText = "Agregar Producto";
    document.getElementById('nuevo-nombre').value = '';
    document.getElementById('nueva-referencia').value = generarReferenciaUnica();
    document.getElementById('nuevo-precio').value = '';
    document.getElementById('nuevo-precio-mayorista').value = '';
    document.getElementById('nueva-cant-min-mayorista').value = '';
    document.getElementById('nuevo-agotado').checked = false;
    document.getElementById('nuevo-destacado').checked = false;
    document.getElementById('preview-img').style.display = 'none';
    imagenSubidaUrl = '';

    document.getElementById('modal-admin').style.display = 'block';
}

function cerrarModal() {
    document.getElementById('modal-admin').style.display = 'none';
}

function prepararEdicion(prod) {
    document.getElementById('edit-id').value = prod.id;
    document.getElementById('modal-titulo').innerText = "Editar Producto";
    document.getElementById('nuevo-nombre').value = prod.nombre || '';
    document.getElementById('nueva-referencia').value = prod.referencia || generarReferenciaUnica();
    document.getElementById('nuevo-precio').value = prod.precio || '';
    document.getElementById('nuevo-precio-mayorista').value = prod.precio_mayorista || '';
    document.getElementById('nueva-cant-min-mayorista').value = prod.cant_min_mayorista || '';
    document.getElementById('nuevo-categoria').value = prod.categoria || '';
    document.getElementById('nuevo-agotado').checked = prod.agotado || false;
    document.getElementById('nuevo-destacado').checked = prod.destacado || false;

    if (prod.imagen_url) {
        imagenSubidaUrl = prod.imagen_url;
        const img = document.getElementById('preview-img');
        img.src = prod.imagen_url;
        img.style.display = 'block';
    } else {
        imagenSubidaUrl = '';
        document.getElementById('preview-img').style.display = 'none';
    }

    document.getElementById('modal-admin').style.display = 'block';
}

async function guardarProducto() {
    const botonGuardar = document.getElementById('btn-accion-guardar');
    if (botonGuardar?.disabled) return;
    const id = document.getElementById('edit-id').value;
    const nombre = document.getElementById('nuevo-nombre').value.trim();
    const referencia = document.getElementById('nueva-referencia').value.trim();
    const precio = parseFloat(document.getElementById('nuevo-precio').value) || 0;
    const precioMayorista = parseFloat(document.getElementById('nuevo-precio-mayorista').value) || 0;
    const cantMinMayorista = parseInt(document.getElementById('nueva-cant-min-mayorista').value) || 0;
    const categoria = document.getElementById('nuevo-categoria').value;
    const agotado = document.getElementById('nuevo-agotado').checked;
    const destacado = document.getElementById('nuevo-destacado').checked;

    if (!nombre) return mostrarToast("Ingresa el nombre del producto", "error");

    const payload = {
        nombre,
        referencia,
        precio,
        precio_mayorista: precioMayorista,
        cant_min_mayorista: cantMinMayorista,
        categoria,
        agotado,
        destacado,
        imagen_url: imagenSubidaUrl
    };

    if (botonGuardar) {
        botonGuardar.disabled = true;
        botonGuardar.dataset.textoOriginal = botonGuardar.textContent;
        botonGuardar.textContent = id ? 'Actualizando...' : 'Guardando...';
    }

    let res;
    try {
        if (id) {
            res = await _supabase.from('productos').update(payload).eq('id', id);
        } else {
            res = await _supabase.from('productos').insert([payload]);
        }
    } catch (error) {
        res = { error };
    }

    if (!res.error) {
        mostrarToast(id ? "Producto actualizado" : "Producto creado", "success");
        cerrarModal();
        cargarProductos();
        cargarCategorias();
    } else {
        mostrarToast("Error al guardar: " + (res.error?.message || 'Revisa la configuración y las políticas de Supabase'), "error");
    }

    if (botonGuardar) {
        botonGuardar.disabled = false;
        botonGuardar.textContent = botonGuardar.dataset.textoOriginal || 'Guardar Producto';
    }
}

async function eliminarProducto(id) {
    if (confirm("¿Seguro que deseas eliminar este producto?")) {
        const { error } = await _supabase.from('productos').delete().eq('id', id);
        if (!error) {
            mostrarToast("Producto eliminado", "success");
            cargarProductos();
        } else {
            mostrarToast("Error al eliminar", "error");
        }
    }
}

function crearNuevaCategoria() {
    const nuevaCat = prompt("Nombre de la nueva categoría:");
    if (nuevaCat && nuevaCat.trim() !== '') {
        const nombreCat = nuevaCat.trim();
        if (!categoriasGlobales.includes(nombreCat)) {
            categoriasGlobales.push(nombreCat);
            poblarCategoriasSelect();
            document.getElementById('nuevo-categoria').value = nombreCat;
        }
    }
}

function gestionarCategoriasModal() {
    let msg = "Categorías actuales:\n" + categoriasGlobales.map((c, i) => `${i + 1}. ${c}`).join('\n');
    alert(msg);
}

/* ==========================================================================
   SUBIDA DE IMÁGENES (DROPZONE & CLIPBOARD)
   ========================================================================== */

function configurarDropZone() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    if (!dropZone || !fileInput) return;

    dropZone.onclick = () => fileInput.click();
    dropZone.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInput.click();
        }
    };

    fileInput.onchange = (e) => {
        if (e.target.files.length > 0) procesarArchivoImagen(e.target.files[0]);
    };

    dropZone.ondragover = (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    };
    dropZone.ondragleave = () => dropZone.classList.remove('dragover');
    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) procesarArchivoImagen(e.dataTransfer.files[0]);
    };

    document.onpaste = (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let item of items) {
            if (item.kind === 'file') {
                procesarArchivoImagen(item.getAsFile());
            }
        }
    };
}

async function procesarArchivoImagen(file) {
    if (!file || !file.type.startsWith('image/')) return mostrarToast("El archivo debe ser una imagen", "error");
    if (file.size > 8 * 1024 * 1024) return mostrarToast("La imagen no debe superar 8 MB", "error");

    const spinner = document.getElementById('spinner-subida');
    if (spinner) spinner.style.display = 'block';

    const fileExt = file.name ? file.name.split('.').pop() : 'png';
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

    let uploadResult;
    try {
        uploadResult = await _supabase.storage
            .from('imagenes_productos')
            .upload(fileName, file, {
                cacheControl: '3600',
                contentType: file.type,
                upsert: false
            });
    } catch (uploadError) {
        uploadResult = { error: uploadError };
    }

    if (spinner) spinner.style.display = 'none';
    const { error } = uploadResult || {};

    if (error) {
        mostrarToast("Error al subir imagen: " + (error.message || 'Revisa el bucket y sus políticas'), "error");
        return;
    }

    const { data: publicUrlData } = _supabase.storage.from('imagenes_productos').getPublicUrl(fileName);
    imagenSubidaUrl = publicUrlData.publicUrl;

    const img = document.getElementById('preview-img');
    if (img) {
        img.src = imagenSubidaUrl;
        img.style.display = 'block';
    }
    mostrarToast("Imagen subida con éxito", "success");
}

/* ==========================================================================
   NOTIFICACIONES TOAST
   ========================================================================== */

function mostrarToast(mensaje, tipo = "success") {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.innerText = mensaje;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}