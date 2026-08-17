const SUPABASE_URL = 'https://xdwtgtxeiksxemmpkfkk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhkd3RndHhlaWtzeGVtbXBrZmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MjIwMTQsImV4cCI6MjEwMjM5ODAxNH0.aWq8B2FIr1PJJN7Dg9EpRMOVIuYdajacuujEg3lTjsQ';


// 2. Declaración de Variables Globales del Sistema
let productosGlobales = [];
let categoriasGlobales = [];
let cantidadesSeleccionadas = {};
let carrito = {};
let tasaBCV = 771.00;
let categoriaActiva = "Todos";
let busquedaTexto = "";
let imagenSubidaUrl = "";

// 3. Inicialización del Cliente de Supabase
const { createClient } = window.supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Event Listener Inicial
document.addEventListener("DOMContentLoaded", () => {
    cargarTasaBCV();
    cargarCategorias();
    cargarProductos();
    configurarDropZone();
});

// Generar referencia única automática
function generarReferenciaUnica() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `REF-${code}`;
}

async function cargarTasaBCV() {
    try {
        const { data, error } = await _supabase.from('configuracion').select('valor').eq('clave', 'tasa_bcv').single();
        if (data && data.valor) {
            tasaBCV = parseFloat(data.valor);
            const elTexto = document.getElementById('texto-tasa-bcv');
            if (elTexto) elTexto.innerText = `Tasa: Bs ${tasaBCV.toFixed(2)}`;
            const inputTasa = document.getElementById('input-nueva-tasa');
            if (inputTasa) inputTasa.value = tasaBCV.toFixed(2);
        }
    } catch (e) {
        console.warn("No se pudo cargar la tasa de la BD, usando valor por defecto.");
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

async function cargarCategorias() {
    const { data, error } = await _supabase.from('productos').select('categoria');
    if (data) {
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
            <div class="precio-usd">$${precioAplicado.toFixed(2)}</div>
            <div class="precio-bs">Bs ${precioBs}</div>
            
            ${prod.cant_min_mayorista > 0 ? `
                <div class="info-mayorista-badge">
                    Mayorista (${prod.cant_min_mayorista}+ unids): $${Number(prod.precio_mayorista).toFixed(2)}
                </div>
            ` : ''}

            <div class="admin-card-controls">
                <button class="btn-editar-card" onclick='prepararEdicion(${JSON.stringify(prod)})'>✏️ Editar</button>
                <button class="btn-toggle-agotado" onclick="toggleAgotado('${prod.id}', ${!prod.agotado})">
                    ${prod.agotado ? '✅ Disponible' : '🚫 Agotado'}
                </button>
                <button class="btn-eliminar-card" onclick="eliminarProducto('${prod.id}')">🗑️</button>
            </div>

            <div class="selector-cantidad">
                <button onclick="cambiarCantidadSeleccionada('${prod.id}', -1)" ${prod.agotado ? 'disabled' : ''}>-</button>
                <span>${cant}</span>
                <button onclick="cambiarCantidadSeleccionada('${prod.id}', 1)" ${prod.agotado ? 'disabled' : ''}>+</button>
            </div>
            
            <button class="btn-agregar" onclick="agregarAlCarrito('${prod.id}')" ${prod.agotado ? 'disabled' : ''}>
                ${prod.agotado ? 'Agotado' : 'Agregar al Carrito'}
            </button>
        `;
        contenedor.appendChild(card);
    });
}

function cambiarCantidadSeleccionada(id, cambio) {
    const actual = cantidadesSeleccionadas[id] || 1;
    cantidadesSeleccionadas[id] = Math.max(1, actual + cambio);
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

// Carrito
function agregarAlCarrito(id) {
    const prod = productosGlobales.find(p => p.id === id);
    if (!prod || prod.agotado) return;

    const cantAAgregar = cantidadesSeleccionadas[id] || 1;
    if (carrito[id]) {
        carrito[id].cantidad += cantAAgregar;
    } else {
        carrito[id] = { producto: prod, cantidad: cantAAgregar };
    }

    cantidadesSeleccionadas[id] = 1;
    actualizarCarritoUI();
    renderizarProductos();
    mostrarToast(`Agregado: ${prod.nombre}`, "success");
}

function cambiarCantidadCarrito(id, cambio) {
    if (!carrito[id]) return;
    carrito[id].cantidad += cambio;
    if (carrito[id].cantidad <= 0) {
        delete carrito[id];
    }
    actualizarCarritoUI();
    renderizarProductos();
}

function actualizarCarritoUI() {
    const lista = document.getElementById('lista-carrito-items');
    const contador = document.getElementById('contador-carrito');
    const contenedorTotales = document.getElementById('resumen-totales-carrito');
    if (!lista || !contador || !contenedorTotales) return;

    lista.innerHTML = '';
    let totalUSD = 0;
    let totalItems = 0;

    Object.keys(carrito).forEach(id => {
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
            <div class="item-carrito-info">
                <h4>${prod.nombre} ${esMayorista ? '🏷️ (May)' : ''}</h4>
                <p>Ref: ${prod.referencia || 'N/A'}</p>
                <p>$${precioUnitario.toFixed(2)} x ${cant} = <b>$${subtotalUSD.toFixed(2)}</b></p>
            </div>
            <div class="selector-cantidad">
                <button onclick="cambiarCantidadCarrito('${id}', -1)">-</button>
                <span>${cant}</span>
                <button onclick="cambiarCantidadCarrito('${id}', 1)">+</button>
            </div>
        `;
        lista.appendChild(div);
    });

    const totalBS = totalUSD * tasaBCV;
    contador.innerText = totalItems;

    contenedorTotales.innerHTML = `
        <div><span>Subtotal USD:</span> <b>$${totalUSD.toFixed(2)}</b></div>
        <div><span>Total estimado Bs:</span> <b>Bs ${totalBS.toFixed(2)}</b></div>
    `;
}

function togglePanelCarrito() {
    const panel = document.getElementById('panel-carrito');
    if (panel) panel.classList.toggle('activo');
}

function enviarPedidoWhatsApp() {
    const keys = Object.keys(carrito);
    if (keys.length === 0) return mostrarToast("Tu carrito está vacío", "error");

    const selectPago = document.getElementById('metodo-pago-select');
    const metodoPago = selectPago ? selectPago.value : 'No especificado';
    let mensaje = "🛒 *NUEVO PEDIDO DITICO*\n----------------------------------\n";
    let totalUSD = 0;

    keys.forEach(id => {
        const item = carrito[id];
        const prod = item.producto;
        const cant = item.cantidad;

        const esMayorista = prod.cant_min_mayorista > 0 && cant >= prod.cant_min_mayorista;
        const precioUnitario = esMayorista ? (prod.precio_mayorista || prod.precio) : prod.precio;
        const subtotal = precioUnitario * cant;
        totalUSD += subtotal;

        mensaje += `• ${cant}x ${prod.nombre} [Ref: ${prod.referencia || 'N/A'}] ${esMayorista ? '*(Precio Mayorista)*' : ''} - $${subtotal.toFixed(2)}\n`;
    });

    const totalBs = totalUSD * tasaBCV;
    mensaje += "----------------------------------\n";
    mensaje += `*Total USD:* $${totalUSD.toFixed(2)}\n`;
    mensaje += `*Total Bs (Tasa ${tasaBCV.toFixed(2)}):* Bs ${totalBs.toFixed(2)}\n`;
    mensaje += `*Método de Pago:* ${metodoPago}\n`;

    const url = `https://wa.me/584241191218?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
}

// Modal Admin
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

// Subida de Imagenes
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

function mostrarToast(mensaje, tipo = "success") {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.innerText = mensaje;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}