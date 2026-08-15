const SUPABASE_URL = 'https://xdwtgtxeiksxemmpkfkk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhkd3RndHhlaWtzeGVtbXBrZmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MjIwMTQsImV4cCI6MjEwMjM5ODAxNH0.aWq8B2FIr1PJJN7Dg9EpRMOVIuYdajacuujEg3lTjsQ';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let carrito = [];
let productosTotales = [];
let categoriasDinamicas = ['Ferretería', 'Papelería', 'Juguetería'];
const TASA_BCV = 40.50;

async function cargarDatos() {
    const { data: productos, error } = await supabaseClient
        .from('productos')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        console.log('Error al cargar:', error);
        return;
    }
    
    productosTotales = productos;
    
    const catsBD = [...new Set(productos.map(p => p.categoria))];
    catsBD.forEach(c => { if(c && !categoriasDinamicas.includes(c)) categoriasDinamicas.push(c); });

    actualizarMenuCategorias();
    actualizarSelectModal();
    renderizarProductos(productosTotales);
}

function actualizarMenuCategorias() {
    const nav = document.getElementById('menu-categorias');
    nav.innerHTML = `<button onclick="filtrarCategoria('Todos')">Todos</button>`;
    categoriasDinamicas.forEach(cat => {
        nav.innerHTML += `<button onclick="filtrarCategoria('${cat}')">${cat}</button>`;
    });
}

function actualizarSelectModal() {
    const select = document.getElementById('nuevo-categoria');
    select.innerHTML = '';
    categoriasDinamicas.forEach(cat => {
        select.innerHTML += `<option value="${cat}">${cat}</option>`;
    });
}

function crearNuevaCategoria() {
    const nueva = prompt('Nombre de la nueva categoría:');
    if (nueva && nueva.trim() !== '') {
        const catLimpia = nueva.trim();
        if (!categoriasDinamicas.includes(catLimpia)) {
            categoriasDinamicas.push(catLimpia);
            actualizarMenuCategorias();
            actualizarSelectModal();
            document.getElementById('nuevo-categoria').value = catLimpia;
        }
    }
}

function renderizarProductos(productos) {
    const contenedor = document.getElementById('contenedor-productos');
    contenedor.innerHTML = '';

    productos.forEach(prod => {
        const precioBs = (prod.precio * TASA_BCV).toFixed(2);
        contenedor.innerHTML += `
            <div class="card">
                <div>
                    <img src="${prod.imagen}" alt="${prod.nombre}">
                    <h3>${prod.nombre}</h3>
                    <p class="precio-usd">$${prod.precio.toFixed(2)}</p>
                    <p class="precio-bs">Bs ${precioBs}</p>
                </div>
                <div>
                    <div class="selector-cantidad">
                        <button onclick="cambiarCantLocal('${prod.nombre.replace(/['"]+/g, '')}', -1)">-</button>
                        <span id="cant-${prod.nombre.replace(/\s+/g, '')}">1</span>
                        <button onclick="cambiarCantLocal('${prod.nombre.replace(/['"]+/g, '')}', 1)">+</button>
                    </div>
                    <button class="btn-agregar" onclick="agregarAlCarritoConCantidad('${prod.nombre.replace(/['"]+/g, '')}', ${prod.precio})">Agregar</button>
                </div>
            </div>
        `;
    });
}

function cambiarCantLocal(nombre, cambio) {
    const idSpan = `cant-${nombre.replace(/\s+/g, '')}`;
    const span = document.getElementById(idSpan);
    if (!span) return;
    let actual = parseInt(span.innerText) + cambio;
    if (actual < 1) actual = 1;
    span.innerText = actual;
}

function agregarAlCarritoConCantidad(nombre, precio) {
    const idSpan = `cant-${nombre.replace(/\s+/g, '')}`;
    const span = document.getElementById(idSpan);
    const cantidad = span ? parseInt(span.innerText) : 1;
    
    const index = carrito.findIndex(item => item.nombre === nombre);
    if (index > -1) {
        carrito[index].cantidad += cantidad;
    } else {
        carrito.push({ nombre, precio, cantidad });
    }
    actualizarContadorCarrito();
    if (span) span.innerText = '1';
}

function actualizarContadorCarrito() {
    const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);
    document.getElementById('contador-carrito').innerText = totalItems;
    renderizarPanelCarrito();
}

function togglePanelCarrito() {
    document.getElementById('panel-carrito').classList.toggle('activo');
}

function renderizarPanelCarrito() {
    const lista = document.getElementById('lista-carrito-items');
    if (carrito.length === 0) {
        lista.innerHTML = '<p style="text-align:center; color:#888; margin-top:40px;">Tu carrito está vacío</p>';
        return;
    }

    lista.innerHTML = '';
    let totalUsd = 0;

    carrito.forEach((item, index) => {
        const subtotal = item.precio * item.cantidad;
        totalUsd += subtotal;
        lista.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:10px;">
                <div>
                    <strong>${item.nombre}</strong><br>
                    <small>$${item.precio.toFixed(2)} x ${item.cantidad}</small>
                </div>
                <div>
                    <span style="font-weight:700; color:#2ed573;">$${subtotal.toFixed(2)}</span>
                    <button onclick="eliminarItem(${index})" style="background:none; border:none; color:red; cursor:pointer; margin-left:10px;">🗑️</button>
                </div>
            </div>
        `;
    });

    let totalBs = (totalUsd * TASA_BCV).toFixed(2);
    lista.innerHTML += `
        <div style="margin-top:20px; font-weight:700; font-size:1.1rem; text-align:right;">
            Total USD: $${totalUsd.toFixed(2)}<br>
            Total Bs: Bs ${totalBs}
        </div>
    `;
}

function eliminarItem(index) {
    carrito.splice(index, 1);
    actualizarContadorCarrito();
}

function filtrarCategoria(categoria) {
    if (categoria === 'Todos') {
        renderizarProductos(productosTotales);
    } else {
        const filtrados = productosTotales.filter(p => p.categoria === categoria);
        renderizarProductos(filtrados);
    }
}

function enviarPedidoWhatsApp() {
    if (carrito.length === 0) {
        alert('El carrito está vacío');
        return;
    }

    let mensaje = 'Hola *DITICO*, quiero hacer el siguiente pedido:%0A%0A';
    let totalUsd = 0;

    carrito.forEach(item => {
        let sub = item.precio * item.cantidad;
        mensaje += `🛍️ ${item.nombre} (${item.cantidad} unid) - $${sub.toFixed(2)}%0A`;
        totalUsd += sub;
    });

    let totalBs = (totalUsd * TASA_BCV).toFixed(2);
    mensaje += `%0A*Total USD:* $${totalUsd.toFixed(2)}`;
    mensaje += `%0A*Total Bs:* Bs ${totalBs}`;
    mensaje += `%0A%0AIndícame los datos para realizar el pago (Pago Móvil / Divisas / Bolívares).`;

    const telefono = '584241191218'; 
    window.open(`https://wa.me/${telefono}?text=${mensaje}`, '_blank');
}

// LÓGICA DEL MODAL
let base64Imagen = '';
function abrirModal() { document.getElementById('modal-admin').style.display = 'block'; }
function cerrarModal() { document.getElementById('modal-admin').style.display = 'none'; resetearFormulario(); }

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const previewImg = document.getElementById('preview-img');

if (dropZone) {
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.background = '#d0e8f2'; });
    dropZone.addEventListener('dragleave', () => { dropZone.style.background = '#f0f8ff'; });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.background = '#f0f8ff';
        if (e.dataTransfer.files.length > 0) procesarArchivo(e.dataTransfer.files[0]);
    });
}

if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) procesarArchivo(e.target.files[0]);
    });
}

window.addEventListener('paste', (e) => {
    const modal = document.getElementById('modal-admin');
    if (modal && modal.style.display === 'block') {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                procesarArchivo(items[i].getAsFile());
            }
        }
    }
});

function procesarArchivo(file) {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        const img = new Image();
        img.src = reader.result;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 600;
            const scaleSize = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH;
            canvas.height = img.height * scaleSize;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            base64Imagen = canvas.toDataURL('image/jpeg', 0.6);
            previewImg.src = base64Imagen;
            previewImg.style.display = 'block';
            dropZone.querySelector('p').style.display = 'none';
        }
    };
}

async function guardarProducto() {
    const nombre = document.getElementById('nuevo-nombre').value;
    const precio = parseFloat(document.getElementById('nuevo-precio').value);
    const categoria = document.getElementById('nuevo-categoria').value;

    if (!nombre || isNaN(precio) || !base64Imagen) {
        alert('Por favor, llena el nombre, el precio válido y sube una imagen.');
        return;
    }

    const { error } = await supabaseClient
        .from('productos')
        .insert([{ nombre, precio, categoria, imagen: base64Imagen }]);

    if (error) {
        alert('Hubo un error al guardar: ' + error.message);
    } else {
        cerrarModal();
        cargarDatos();
    }
}

function resetearFormulario() {
    document.getElementById('nuevo-nombre').value = '';
    document.getElementById('nuevo-precio').value = '';
    base64Imagen = '';
    previewImg.style.display = 'none';
    dropZone.querySelector('p').style.display = 'block';
    fileInput.value = '';
}

cargarDatos();