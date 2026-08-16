const SUPABASE_URL = 'https://xdwtgtxeiksxemmpkfkk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhkd3RndHhlaWtzeGVtbXBrZmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MjIwMTQsImV4cCI6MjEwMjM5ODAxNH0.aWq8B2FIr1PJJN7Dg9EpRMOVIuYdajacuujEg3lTjsQ';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let carrito = [];
let productosTotales = [];
let categoriasDinamicas = ['Ferretería', 'Papelería', 'Juguetería'];
let TASA_BCV = 771.00;

async function cargarDatos() {
    try {
        const { data: productos, error } = await supabaseClient
            .from('productos')
            .select('*')
            .order('id', { ascending: false });

        if (error) throw error;
        
        productosTotales = productos;
        // Guardar copia de seguridad local para cuando no haya internet
        localStorage.setItem('ditico_productos', JSON.stringify(productos));

    } catch (error) {
        console.log('Sin conexión a Supabase. Cargando datos locales...', error);
        const productosLocales = localStorage.getItem('ditico_productos');
        if (productosLocales) {
            productosTotales = JSON.parse(productosLocales);
            mostrarNotificacion('Modo sin conexión: Mostrando datos guardados.', 'success');
        } else {
            productosTotales = [];
            mostrarNotificacion('No hay internet ni datos guardados previamente.');
        }
    }
    
    const catsBD = [...new Set(productosTotales.map(p => p.categoria))];
    catsBD.forEach(c => { if(c && !categoriasDinamicas.includes(c)) categoriasDinamicas.push(c); });

    actualizarMenuCategorias();
    actualizarSelectModal();
    renderizarProductos(productosTotales);
}

function actualizarTasaBCV() {
    const inputTasa = document.getElementById('input-nueva-tasa');
    const valor = parseFloat(inputTasa.value);
    if (!isNaN(valor) && valor > 0) {
        TASA_BCV = valor;
        document.getElementById('texto-tasa-bcv').innerText = `Tasa: Bs ${TASA_BCV.toFixed(2)}`;
        renderizarProductos(productosTotales);
        mostrarNotificacion('Tasa actualizada correctamente.');
    } else {
        mostrarNotificacion('Ingresa una tasa válida.');
    }
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

    if (productos.length === 0) {
        contenedor.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#888;">No se encontraron productos.</p>';
        return;
    }

    productos.forEach(prod => {
        const precioBs = (prod.precio * TASA_BCV).toFixed(2);
        const nombreSeguro = prod.nombre.replace(/'/g, "\\'");
        
        contenedor.innerHTML += `
            <div class="card">
                <div>
                    <img src="${prod.imagen}" alt="${prod.nombre}">
                    <h3>${prod.nombre}</h3>
                    <p class="precio-usd">$${prod.precio.toFixed(2)}</p>
                    <p class="precio-bs">Bs ${precioBs}</p>
                </div>
                <div>
                    <div class="admin-card-controls">
                        <button class="btn-editar-card" onclick="abrirModalEditar(${prod.id}, '${nombreSeguro}', ${prod.precio}, '${prod.categoria}', '${prod.imagen}')">Editar</button>
                        <button class="btn-eliminar-card" onclick="eliminarProducto(${prod.id})">Eliminar</button>
                    </div>

                    <div class="selector-cantidad">
                        <button onclick="cambiarCantLocal('${nombreSeguro}', -1)">-</button>
                        <span id="cant-${prod.nombre.replace(/\s+/g, '')}">1</span>
                        <button onclick="cambiarCantLocal('${nombreSeguro}', 1)">+</button>
                    </div>
                    <button class="btn-agregar" onclick="agregarAlCarritoConCantidad('${nombreSeguro}', ${prod.precio})">Agregar</button>
                </div>
            </div>
        `;
    });
}

function buscarProductos(texto) {
    const query = texto.toLowerCase().trim();
    if (query === '') {
        renderizarProductos(productosTotales);
        return;
    }
    const filtrados = productosTotales.filter(p => p.nombre.toLowerCase().includes(query) || (p.categoria && p.categoria.toLowerCase().includes(query)));
    renderizarProductos(filtrados);
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
    document.getElementById('input-buscador').value = '';
    if (categoria === 'Todos') {
        renderizarProductos(productosTotales);
    } else {
        const filtrados = productosTotales.filter(p => p.categoria === categoria);
        renderizarProductos(filtrados);
    }
}

function enviarPedidoWhatsApp() {
    if (carrito.length === 0) {
        mostrarNotificacion('El carrito está vacío');
        return;
    }

    const metodoPagoSeleccionado = document.getElementById('metodo-pago-select').value;

    let mensaje = 'Hola *DITICO*, quiero hacer el siguiente pedido:%0A%0A';
    let totalUsd = 0;

    carrito.forEach(item => {
        let sub = item.precio * item.cantidad;
        mensaje += `🛍️ *${item.nombre}* (${item.cantidad} unid) - $${sub.toFixed(2)}%0A`;
        
        // Buscar el producto para adjuntar el link de la imagen pública de Supabase Storage
        const prodOriginal = productosTotales.find(p => p.nombre === item.nombre);
        if (prodOriginal && prodOriginal.imagen) {
            mensaje += `🖼️ Ver foto: ${prodOriginal.imagen}%0A`;
        }
        mensaje += `%0A`;
        totalUsd += sub;
    });

    let totalBs = (totalUsd * TASA_BCV).toFixed(2);
    mensaje += `*Total USD:* $${totalUsd.toFixed(2)}`;
    mensaje += `%0A*Total Bs:* Bs ${totalBs}`;
    mensaje += `%0A*Método de pago seleccionado:* ${metodoPagoSeleccionado}`;
    mensaje += `%0A%0AIndícame los datos necesarios para proceder.`;

    const telefono = '584241191218'; 
    window.open(`https://wa.me/${telefono}?text=${mensaje}`, '_blank');
}

let imagenActualUrl = '';
let archivoImagenSeleccionado = null;

function abrirModal() {
    document.getElementById('edit-id').value = '';
    document.getElementById('modal-titulo').innerText = 'Agregar Producto';
    document.getElementById('btn-accion-guardar').innerText = 'Guardar Producto';
    document.getElementById('nuevo-nombre').value = '';
    document.getElementById('nuevo-precio').value = '';
    imagenActualUrl = '';
    archivoImagenSeleccionado = null;
    previewImg.style.display = 'none';
    dropZone.querySelector('p').style.display = 'block';
    document.getElementById('modal-admin').style.display = 'block';
}

function abrirModalEditar(id, nombre, precio, categoria, imagen) {
    document.getElementById('edit-id').value = id;
    document.getElementById('modal-titulo').innerText = 'Editar Producto';
    document.getElementById('btn-accion-guardar').innerText = 'Actualizar Producto';
    document.getElementById('nuevo-nombre').value = nombre;
    document.getElementById('nuevo-precio').value = precio;
    document.getElementById('nuevo-categoria').value = categoria;
    
    imagenActualUrl = imagen;
    archivoImagenSeleccionado = null;
    previewImg.src = imagen;
    previewImg.style.display = 'block';
    dropZone.querySelector('p').style.display = 'none';
    
    document.getElementById('modal-admin').style.display = 'block';
}

function cerrarModal() { 
    document.getElementById('modal-admin').style.display = 'none'; 
    resetearFormulario(); 
}

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
    archivoImagenSeleccionado = file;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        previewImg.src = reader.result;
        previewImg.style.display = 'block';
        dropZone.querySelector('p').style.display = 'none';
    };
}

async function guardarProducto() {
    const id = document.getElementById('edit-id').value;
    const nombre = document.getElementById('nuevo-nombre').value;
    const precioInput = document.getElementById('nuevo-precio').value.replace(',', '.');
    const precio = parseFloat(precioInput);
    const categoria = document.getElementById('nuevo-categoria').value;

    if (!nombre || isNaN(precio)) {
        mostrarNotificacion('Por favor, llena el nombre y un precio válido.');
        return;
    }

    let urlFinalImagen = imagenActualUrl;

    if (archivoImagenSeleccionado) {
        const nombreArchivo = `${Date.now()}_${archivoImagenSeleccionado.name.replace(/\s+/g, '_')}`;
        const { error: uploadError } = await supabaseClient.storage
            .from('productos')
            .upload(nombreArchivo, archivoImagenSeleccionado);

        if (uploadError) {
            mostrarNotificacion('Error al subir la imagen al Storage: ' + uploadError.message);
            return;
        }

        const { data: publicUrlData } = supabaseClient.storage
            .from('productos')
            .getPublicUrl(nombreArchivo);

        urlFinalImagen = publicUrlData.publicUrl;
    }

    if (!urlFinalImagen) {
        mostrarNotificacion('Asegúrate de agregar una imagen para el producto.');
        return;
    }

    if (id) {
        const { error } = await supabaseClient
            .from('productos')
            .update({ nombre, precio, categoria, imagen: urlFinalImagen })
            .eq('id', id);

        if (error) {
            mostrarNotificacion('Error al actualizar: ' + error.message);
        } else {
            cerrarModal();
            cargarDatos();
        }
    } else {
        const { error } = await supabaseClient
            .from('productos')
            .insert([{ nombre, precio, categoria, imagen: urlFinalImagen }]);

        if (error) {
            mostrarNotificacion('Hubo un error al guardar: ' + error.message);
        } else {
            cerrarModal();
            cargarDatos();
        }
    }
}

async function eliminarProducto(id) {
    if (confirm('¿Estás segura de que deseas eliminar este producto?')) {
        const { error } = await supabaseClient
            .from('productos')
            .delete()
            .eq('id', id);

        if (error) {
            mostrarNotificacion('Error al eliminar: ' + error.message);
        } else {
            cargarDatos();
        }
    }
}

function resetearFormulario() {
    document.getElementById('edit-id').value = '';
    document.getElementById('nuevo-nombre').value = '';
    document.getElementById('nuevo-precio').value = '';
    imagenActualUrl = '';
    archivoImagenSeleccionado = null;
    previewImg.style.display = 'none';
    dropZone.querySelector('p').style.display = 'block';
    fileInput.value = '';
}

function mostrarNotificacion(mensaje, tipo = 'error') {
    const contenedor = document.getElementById('toast-container');
    if (!contenedor) return mostrarNotificacion(mensaje); // Fallback por seguridad
    
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.innerText = mensaje;
    
    contenedor.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

cargarDatos();