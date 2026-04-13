// --- 1. CONFIGURACIÓN DE SUPABASE ---
const supabaseUrl = 'https://vqlnugdvpxlkwahphkja.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxbG51Z2R2cHhsa3dhaHBoa2phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MjE3MzksImV4cCI6MjA4ODI5NzczOX0.C1mRssxL6jsydxQwZlQsmZkzJVT5lC6knjYpb3dtLKY';

// SOLUCIÓN: Cambiamos el nombre a 'supabaseClient' para evitar el error de la consola
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// --- VARIABLES GLOBALES AÑADIDAS PARA LAS CITAS ---
let currentPropertyId = null;   // ID del Inventario (usado para la URL)
let currentSolicitudId = null;  // ID de la Solicitud (usado para la Base de Datos)
let fotosActualesEdicion = []; // Las URLs que el usuario decide conservar
let fotosABorrarStorage = [];  // Las URLs que vamos a eliminar físicamente

// --- 2. BASE DE DATOS MOCK (Temporal para la Galería) ---
const propiedades = [
    { id: 1, titulo: "Residencia Lomas I", ubicacion: "Lomas de Angelópolis", precio: "$4,500,000 MXN", img: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80", hab: 3, banos: 3, area: "250m²", tipo: "Venta", badgeClass: "badge-venta" },
    { id: 2, titulo: "Depa Torre Adamant", ubicacion: "Zona Atlixcáyotl", precio: "$15,000 / mes", img: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80", hab: 2, banos: 2, area: "110m²", tipo: "Renta", badgeClass: "badge-renta" },
    { id: 3, titulo: "Cuarto Amueblado UTP", ubicacion: "Zona Universidad", precio: "$3,500 / mes", img: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80", hab: 1, banos: 1, area: "20m²", tipo: "Habitación", badgeClass: "badge-hab" }
];

// --- 3. INICIALIZACIÓN Y RUTEO DINÁMICO (PROTECCIÓN TOTAL) ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Obtenemos la sesión global de Supabase
    const { data: { session } } = await supabaseClient.auth.getSession();

    // --- EL CADENERO: PROTECCIÓN DE TODA LA CARPETA / ARCHIVOS ADMIN ---
    const esRutaAdmin = window.location.pathname.toLowerCase().includes('admin');

    if (esRutaAdmin) {
        if (!session) {
            window.location.replace('login.html');
            return;
        }

        const { data: perfil } = await supabaseClient
            .from('perfiles')
            .select('rol')
            .eq('id', session.user.id)
            .maybeSingle();

        if (!perfil || perfil.rol !== 'admin') {
            alert("🛑 Acceso Denegado: No tienes permisos para gestionar el catálogo.");
            window.location.replace('index.html');
            return;
        }
    }

    // --- 2. ACTUALIZACIÓN DE INTERFAZ GENERAL (NAVBAR) ---
    updateIndexUI(session);

    // --- 3. LOGICA DINÁMICA DE LA BARRA DE BÚSQUEDA (INDEX) ---
    // Si existe el select de ubicación, llenamos las opciones reales
    if (document.getElementById('search-ubicacion')) {
        console.log("🔍 Detectada barra de búsqueda. Cargando ubicaciones...");
        cargarUbicacionesDinamicas();
    }

    // --- 4. CONTINÚA TU LÓGICA DE RUTEO EXISTENTE ---
    if (document.getElementById('properties-container')) {
        renderProperties();
    }

    
    // -------------------------------------------------------------

    // Actualizamos el Nav (esto se queda igual)
    updateIndexUI(session);

    // --- CONTINÚA TU LÓGICA DE RUTEO EXISTENTE ---
    if (window.location.pathname.includes('borrador.html')) {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        if (id) loadBorradorDetails(id);
    } 
    else if (document.getElementById('detalle-content')) {
        const params = new URLSearchParams(window.location.search);
        currentPropertyId = params.get('id');
        
        if (currentPropertyId) {
            await loadPropertyDetails(currentPropertyId);
            setupAgendarForm();
            setupFavoritosListener();
        } else {
            document.getElementById('detalle-loading').innerHTML = `
                <h3 class="text-danger mt-5">Propiedad no encontrada</h3>
                <a href="index.html" class="btn btn-dark mt-3">Volver al inicio</a>
            `;
        }
    }

    // B. LÓGICA DE CATÁLOGO (index.html)
    if (document.getElementById('properties-container')) {
        renderProperties();
    }

    // D. LÓGICA DE PUBLICACIÓN (publicar.html)
    if (document.getElementById('form-publicar')) {
        setupPublicarForm();
    }

    // E. LÓGICA DE MI PANEL (cliente.html)
    if (document.getElementById('cliente-citas-container')) {
        loadClienteDashboard();
    }

    // F. LÓGICA DE ADMINISTRADOR (Detección por Título)
    if (document.title.includes("Inventario")) loadAdminInventario();
    if (document.title.includes("Usuarios")) loadAdminUsuarios();
    if (document.title.includes("Reportes")) loadAdminReportes();
    
    // Si estás en el dashboard principal de admin
    if (document.getElementById('admin-solicitudes-container')) {
        loadAdminDashboard();
        // Ponemos la fecha actual
        const options = { day: 'numeric', month: 'short' };
        document.getElementById('admin-date-display').innerText = new Date().toLocaleDateString('es-ES', options);
    }
});

// --- 4. LÓGICA DE INICIO DE SESIÓN REAL ---
async function handleLoginPage() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    const msgDiv = document.getElementById('login-message');
    const btnLogin = document.getElementById('btn-login');

    btnLogin.disabled = true;
    btnLogin.innerText = "Verificando...";
    msgDiv.classList.add('d-none');

    // Autenticación con supabaseClient
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: pass,
    });

    if (error) {
        msgDiv.innerText = "Credenciales incorrectas. Intenta de nuevo.";
        msgDiv.classList.remove('d-none');
        btnLogin.disabled = false;
        btnLogin.innerText = "Ingresar";
        return;
    }

// Buscamos qué ROL y ESTADO tiene
    const { data: perfilData, error: perfilError } = await supabaseClient
        .from('perfiles')
        .select('rol, estado') // AÑADIMOS EL ESTADO
        .eq('id', data.user.id)
        .single();

    if (perfilData) {
        // EL GUARDIA DE SEGURIDAD
        if (perfilData.estado === 'bloqueado') {
            await supabaseClient.auth.signOut(); // Lo expulsamos de inmediato
            msgDiv.innerText = "ACCESO DENEGADO: Tu cuenta ha sido bloqueada por un administrador.";
            msgDiv.classList.remove('d-none');
            btnLogin.disabled = false;
            btnLogin.innerText = "Ingresar";
            return;
        }

        if (perfilData.rol === 'admin') {
            window.location.href = 'admin.html'; 
        } else {
            window.location.href = 'index.html'; 
        }
    } else {
        window.location.href = 'index.html'; 
    }
}

// --- 5. LÓGICA DE REGISTRO REAL (CON UPSERT) ---
async function handleRegisterPage() {
    // --- 1. VALIDACIÓN DEL CAPTCHA ---
    const response = grecaptcha.getResponse(); // Obtiene la respuesta del widget de Google

    if (response.length === 0) {
        // El usuario no ha marcado la casilla
        alert("Por favor, verifica que no eres un robot.");
        return; // Detenemos la ejecución aquí
    }
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-pass').value;
    
    // 1. Capturamos y LIMPIAMOS el teléfono (dejamos solo números)
    let phone = document.getElementById('reg-phone').value;
    phone = phone.replace(/\D/g, ''); 
    
    const msgDiv = document.getElementById('reg-message');
    const btnRegister = document.getElementById('btn-register');

    btnRegister.disabled = true;
    btnRegister.innerText = "Creando cuenta...";
    msgDiv.classList.add('d-none');

    // 1. Registro en la bóveda secreta de Supabase Auth
    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: pass,
        options: {
            data: { full_name: name }
        }
    });

    if (error) {
        msgDiv.innerText = error.message;
        msgDiv.classList.remove('alert-success');
        msgDiv.classList.add('alert-danger', 'd-block');
        btnRegister.disabled = false;
        btnRegister.innerText = "Registrarse";
        return; 
    }

    // 2. MAGIA: Copiamos el usuario a la tabla pública 'perfiles' usando UPSERT
    if (data && data.user) {
        const { error: errPerfil } = await supabaseClient
            .from('perfiles')
            .upsert([{ // <-- AQUI ESTÁ EL CAMBIO CLAVE: upsert en vez de insert
                id: data.user.id,             
                nombre_completo: name,
                correo: email,
                telefono: phone,              // <-- El teléfono limpio va aquí
                rol: 'cliente',
                estado: 'activo'              // <-- Aseguramos estado activo
            }], { onConflict: 'id' });        // <-- Le decimos explícitamente qué hacer si hay conflicto

        if (errPerfil) {
            console.error("Error al registrar perfil en tabla:", errPerfil);
            alert("Error al guardar datos de perfil: " + errPerfil.message); 
            btnRegister.disabled = false;
            return;
        }
    }

    // 3. Éxito
    msgDiv.innerText = "¡Cuenta creada con éxito! Redirigiendo...";
    msgDiv.classList.remove('alert-danger');
    msgDiv.classList.add('alert-success', 'd-block');
    
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 2000);
}

// --- 6. ACTUALIZACIÓN DE INTERFAZ (Index) ---
async function updateIndexUI(session) {
    const authBtns = document.getElementById('auth-buttons');
    const userMenu = document.getElementById('user-menu');
    const usernameDisplay = document.getElementById('username-display');
    const adminLink = document.getElementById('admin-link'); // El link que queremos proteger

    if (session) {
        // Mostramos el menú de usuario y ocultamos botones de Login
        if(authBtns) authBtns.classList.add('d-none');
        if(userMenu) userMenu.classList.remove('d-none');
        
        const nombre = session.user.user_metadata.full_name || session.user.email;
        if(usernameDisplay) usernameDisplay.innerText = nombre;

        // --- VALIDACIÓN DE ROL PARA EL MENÚ ---
        const { data: perfil } = await supabaseClient
            .from('perfiles')
            .select('rol')
            .eq('id', session.user.id)
            .single();

        if (adminLink) {
            if (perfil && perfil.rol === 'admin') {
                adminLink.classList.remove('d-none');
            } else {
                adminLink.classList.add('d-none');
            }
        }
    } else {
        // Si no hay sesión, mostramos botones de Login y ocultamos el menú
        if(authBtns) authBtns.classList.remove('d-none');
        if(userMenu) userMenu.classList.add('d-none');
    }
}

// ==========================================
// --- 7. CERRAR SESIÓN CON SUPABASE ---
// ==========================================
window.handleLogout = async function(event) {
    // Si por alguna razón pasas un evento (como en un enlace), esto evita bugs
    if (event) event.preventDefault(); 

    try {
        // 1. Destruimos la sesión en el servidor de Supabase
        await supabaseClient.auth.signOut();
        
        // 2. Redirigimos al usuario a la página pública principal
        window.location.href = 'index.html';
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
        alert("Hubo un problema al cerrar sesión.");
    }
};

// --- 8. RENDERIZADO DE LAS PROPIEDADES (DISEÑO PREMIUM CON ALINEACIÓN PERFECTA) ---
async function renderProperties() {
    const container = document.getElementById('properties-container');
    if(!container) return;

    // A. Construimos la consulta base inteligennte
    let query = supabaseClient
        .from('inventario_publico')
        .select(`
            id,
            solicitudes_publicacion ( 
                titulo, 
                precio, 
                imagenes,
                tipo_operacion,
                ubicacion,
                habitaciones,
                banos,
                estacionamiento,
                estatus_revision
            )
        `);

    // B. Detectamos en qué página estamos para limitar o no
    const rutaActual = window.location.pathname;
    const esIndex = rutaActual.includes('index.html') || rutaActual.endsWith('/');

    // C. Si estamos en el inicio, le agregamos el límite de 3
    if (esIndex) {
        query = query.limit(3);
    }

    // D. Ejecutamos la consulta
    const { data: inventario, error } = await query;

    if (error) {
        console.error("Error cargando propiedades:", error);
        container.innerHTML = '<p class="text-center text-danger">Error al cargar el catálogo.</p>';
        return;
    }

    if (!inventario || inventario.length === 0) {
        container.innerHTML = '<p class="text-center text-muted py-5">Aún no hay propiedades en el inventario.</p>';
        return;
    }

    container.innerHTML = inventario.map(item => {
        const prop = item.solicitudes_publicacion;
        const fotos = prop.imagenes || [];
        
        // Lógica de Portada
        const portada = fotos.length > 0 
            ? fotos[0] 
            : "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80";

        // Lógica del Badge Venta/Renta
        const tipo = prop.tipo_operacion || 'Venta'; 
        const badgeBg = tipo.toLowerCase() === 'renta' ? '#198754' : '#0d6efd'; 
        
        const badgeHTML = `<span class="badge rounded-pill px-3 py-1 shadow-sm" 
                                 style="background-color: ${badgeBg}; font-family: sans-serif; font-size: 0.75rem; letter-spacing: 0.5px; white-space: nowrap;">
                                 ${tipo}
                           </span>`;

        // Formatear el precio
        const precioFormateado = Number(prop.precio).toLocaleString('es-MX');
        const ubicacionTexto = prop.ubicacion || 'Ubicación a consultar';

        // --- NUEVA LÓGICA DE DISPONIBILIDAD ---
        const estatus = prop.estatus_revision;
        const badgeDisponibilidad = (estatus === 'Vendida')
            ? `<span class="position-absolute top-0 start-0 m-3 badge bg-danger text-white px-3 py-2 rounded-pill shadow-sm backdrop-blur" style="backdrop-filter: blur(4px);">
                   <i class="bi bi-tag-fill me-1"></i> Vendida
               </span>`
            : `<span class="position-absolute top-0 start-0 m-3 badge bg-dark bg-opacity-75 text-white px-3 py-2 rounded-pill shadow-sm backdrop-blur" style="backdrop-filter: blur(4px);">
                   <i class="bi bi-check-circle me-1"></i> Disponible
               </span>`;

        // Valores de amenidades
        const habitaciones = prop.habitaciones || '-';
        const banos = prop.banos || '-';
        const estacionamiento = prop.estacionamiento || '-';

        return `
            <div class="col-md-4 mb-4">
                <div class="property-card h-100 shadow-sm bg-white pb-3 rounded-4 border-0" 
                     style="transition: all 0.3s ease; cursor: pointer;"
                     onmouseover="this.classList.replace('shadow-sm', 'shadow-lg'); this.style.transform='translateY(-8px)';"
                     onmouseout="this.classList.replace('shadow-lg', 'shadow-sm'); this.style.transform='translateY(0)';">
                    
                    <div class="position-relative overflow-hidden rounded-top-4" style="height:240px;">
                        <img src="${portada}" 
                             class="img-fluid w-100 h-100" 
                             style="object-fit:cover; transition: transform 0.6s ease;" 
                             alt="${prop.titulo}"
                             onmouseover="this.style.transform='scale(1.08)'" 
                             onmouseout="this.style.transform='scale(1)'">
                        
                        ${badgeDisponibilidad}
                    </div>
                    
                    <div class="px-4 pt-4 pb-2">
                        
                        <div class="mb-3 d-flex flex-column" style="min-height: 5em;"> <div class="fw-bold fs-4" style="color: #1a202c;">$${precioFormateado} <small class="fs-6 text-muted">MXN</small></div>
                            
                            <div class="text-muted small mt-1 d-flex align-items-center" style="font-size: 0.85rem; flex-grow: 1; min-height: 2.6em;">
                                <i class="bi bi-geo-alt-fill text-danger me-1"></i>${ubicacionTexto}
                            </div>
                        </div>
                        
                        <div class="d-flex justify-content-between align-items-start gap-2 mb-3">
                            <h5 class="font-serif fw-bold text-dark mb-0 property-title-align" 
                                style="font-size: 1.15rem; 
                                       line-height: 1.3; 
                                       min-height: calc(1.3em * 2); /* Altura de exactamente 2 líneas: (line-height * 2) */
                                       
                                       /* Magia para limitar el texto a 2 líneas y poner puntos suspensivos si es más largo */
                                       display: -webkit-box; 
                                       -webkit-line-clamp: 2; /* Limita a exactamente 2 líneas */
                                       -webkit-box-orient: vertical; 
                                       overflow: hidden; 
                                       ">
                                ${prop.titulo}
                            </h5>
                            <div>
                                ${badgeHTML}
                            </div>
                        </div>
                        
                        <div class="d-flex gap-4 text-muted mt-2 mb-3" style="font-size: 0.9rem; min-height: 3em; align-items: center;"> <span title="Habitaciones" class="d-flex align-items-center">
                                <i class="bi bi-door-open fs-5 me-2"></i> ${habitaciones}
                            </span>
                            <span title="Baños" class="d-flex align-items-center">
                                <i class="bi bi-droplet fs-5 me-2"></i> ${banos}
                            </span>
                            <span title="Estacionamiento" class="d-flex align-items-center">
                                <i class="bi bi-car-front fs-5 me-2"></i> ${estacionamiento}
                            </span>
                        </div>
                        
                        <hr class="text-muted opacity-25 my-3">
                        
                        <a href="detalle.html?id=${item.id}" class="btn btn-dark w-100 py-2 fw-bold rounded-3" style="letter-spacing: 0.5px;">
                            Ver Detalles <i class="bi bi-arrow-right ms-1"></i>
                        </a>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}


// --- 8 (bis). LÓGICA DEL PANEL DE ADMINISTRADOR ACTUALIZADA ---
async function loadAdminDashboard() {
    const solContainer = document.getElementById('admin-solicitudes-container');
    const citasContainer = document.getElementById('admin-citas-container');
    if (!solContainer || !citasContainer) return;

    // 1. Cargar SOLO LAS SOLICITUDES PENDIENTES (Esto se queda igual)
    const { data: solicitudes, error: errSol } = await supabaseClient
        .from('solicitudes_publicacion')
        .select(`id, titulo, precio, estatus_revision, perfiles(correo)`)
        .eq('estatus_revision', 'Pendiente') 
        .order('id', { ascending: false });

    if (errSol) {
        solContainer.innerHTML = `<tr><td colspan="4" class="text-danger text-center">Error al cargar solicitudes</td></tr>`;
    } else if (!solicitudes || solicitudes.length === 0) {
        solContainer.innerHTML = `<tr><td colspan="4" class="text-muted text-center py-4">¡Todo limpio! No hay solicitudes pendientes.</td></tr>`;
    } else {
        solContainer.innerHTML = solicitudes.map(sol => {
            return `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="bg-light rounded d-flex justify-content-center align-items-center me-3" style="width: 40px; height: 40px;">
                            <i class="bi bi-house text-secondary"></i>
                        </div>
                        <div>
                            <h6 class="mb-0 font-serif small fw-bold">
                                ${sol.titulo} 
                                <a href="borrador.html?id=${sol.id}" target="_blank" class="ms-1 text-primary" title="Revisar borrador">
                                    <i class="bi bi-box-arrow-up-right small"></i>
                                </a>
                            </h6>
                            <small class="text-muted">${sol.perfiles.correo}</small>
                        </div>
                    </div>
                </td>
                <td><span class="badge bg-warning text-dark">${sol.estatus_revision}</span></td>
                <td class="fw-bold text-dark small">$${sol.precio}</td>
                <td>
                    <div class="d-flex gap-1">
                        <button onclick="abrirEvaluadorInteractivo('${sol.id}', '${sol.titulo}')" class="btn btn-sm btn-dark fw-bold px-3 shadow-sm">
                            <i class="bi bi-clipboard-check-fill me-1"></i> Evaluar Calidad
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    // 2. LO NUEVO: ELIMINACIÓN DE LA AGENDA PARA EL ADMIN
    // Como ahora el dueño recibe las ofertas (P2P), el admin ya no debe ver esta sección.
    citasContainer.innerHTML = `
        <tr>
            <td colspan="4">
                <div class="text-center py-5">
                    <i class="bi bi-shield-lock display-4 text-muted mb-3 d-block"></i>
                    <h5 class="text-muted font-serif">Privacidad P2P Activada</h5>
                    <p class="text-muted small px-4 mb-0">
                        Bajo el nuevo modelo, las citas y ofertas son privadas y se envían 
                        directamente al panel del cliente propietario para que negocie sin intermediarios.
                    </p>
                </div>
            </td>
        </tr>
    `;
}
// --- 10. LÓGICA DEL PANEL DE CLIENTE (cliente.html) ---
async function loadClienteDashboard() {
    const citasContainer = document.getElementById('cliente-citas-container');
    const favContainer = document.getElementById('cliente-favoritos-container');
    const solContainer = document.getElementById('cliente-solicitudes-container');
    const nameDisplay = document.getElementById('cliente-username-display');

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html'; 
        return;
    }

    const nombre = session.user.user_metadata.full_name || session.user.email;
    if(nameDisplay) nameDisplay.innerText = nombre;

    // --- 1. Cargar MIS SOLICITUDES (Tus Casas) ---
    const { data: solicitudes, error: errSol } = await supabaseClient
        .from('solicitudes_publicacion')
        .select(`
            id, 
            titulo, 
            precio, 
            estatus_revision,
            motivo_rechazo,
            inventario_publico(id)
        `)
        .eq('propietario_id', session.user.id)
        .order('id', { ascending: false });

    if (errSol) {
        solContainer.innerHTML = `<tr><td colspan="3" class="text-danger text-center">Error al cargar solicitudes.</td></tr>`;
    } else if (!solicitudes || solicitudes.length === 0) {
        solContainer.innerHTML = `<tr><td colspan="3" class="text-center text-muted py-4">Aún no tienes propiedades enviadas.</td></tr>`;
    } else {
        solContainer.innerHTML = solicitudes.map(sol => {
            // Corregimos la lógica del badge para que reconozca el estatus 'Vendida'
            let badgeCls = 'bg-warning text-dark'; 
            if (sol.estatus_revision === 'Aprobada') badgeCls = 'bg-success'; 
            if (sol.estatus_revision === 'Rechazada') badgeCls = 'bg-danger';
            if (sol.estatus_revision === 'Vendida') badgeCls = 'bg-danger text-white';

            // HTML para el motivo de rechazo (si existe)
            const motivoHTML = (sol.estatus_revision === 'Rechazada' && sol.motivo_rechazo) 
                ? `<div class="mt-2 p-2 bg-danger bg-opacity-10 border border-danger border-opacity-25 rounded text-danger shadow-sm" style="font-size: 0.75rem;">
                     <i class="bi bi-exclamation-triangle-fill me-1"></i> <strong>Motivo del rechazo:</strong><br>
                     ${sol.motivo_rechazo.replace(/\n/g, '<br>')}
                   </div>`
                : '';

            const invId = sol.inventario_publico?.[0]?.id; 
            const linkBtn = (sol.estatus_revision === 'Aprobada' && invId) 
                ? `<a href="detalle.html?id=${invId}" class="btn btn-sm btn-outline-dark py-0 px-2 ms-1" title="Ver en Catálogo"><i class="bi bi-globe"></i></a>` 
                : '';

            const previewBtn = (sol.estatus_revision === 'Pendiente' || sol.estatus_revision === 'Rechazada')
                ? `<a href="borrador.html?id=${sol.id}" class="btn btn-sm btn-outline-secondary py-0 px-2 ms-1" title="Vista Previa"><i class="bi bi-file-earmark-medical"></i></a>`
                : '';
            
            const btnEditar = `<button onclick="abrirModalEdicion('${sol.id}')" class="btn btn-sm btn-outline-primary py-0 px-2 ms-1" title="Editar datos"><i class="bi bi-pencil"></i></button>`;
            const btnEliminar = `<button onclick="eliminarPropiedadCliente('${sol.id}')" class="btn btn-sm btn-outline-danger py-0 px-2 ms-1" title="Borrar propiedad"><i class="bi bi-trash"></i></button>`;
            
            return `
            <tr>
                <td class="fw-bold">
                    <div class="mb-1">${sol.titulo}</div>
                    <div class="d-flex gap-1 align-items-center">
                        ${previewBtn}
                        ${linkBtn}
                        ${btnEditar}
                        ${btnEliminar}
                    </div>
                    ${motivoHTML} 
                </td>
                <td>$${Number(sol.precio).toLocaleString('es-MX')} MXN</td>
                <td><span class="badge ${badgeCls}">${sol.estatus_revision}</span></td>
            </tr>`;
        }).join('');
    }

   // --- 2. LO NUEVO: CITAS RECIBIDAS (COMO VENDEDOR P2P) ---
    let recibidasContainer = document.getElementById('cliente-citas-recibidas-container');
    if (!recibidasContainer && citasContainer) {
        citasContainer.insertAdjacentHTML('beforebegin', `
            <h5 class="font-serif fw-bold border-bottom pb-2 mb-3 mt-5 text-primary-custom">
                <i class="bi bi-inbox-fill me-2"></i> Ofertas y Citas Recibidas (Tus Propiedades)
            </h5>
            <div id="cliente-citas-recibidas-container" class="row g-3 mb-4"></div>
            <h5 class="font-serif fw-bold border-bottom pb-2 mb-3 mt-4 text-secondary">
                <i class="bi bi-calendar-event me-2"></i> Mis Citas Agendadas (Como Comprador)
            </h5>
        `);
        recibidasContainer = document.getElementById('cliente-citas-recibidas-container');
    }

    if (recibidasContainer) {
        const { data: citasRecibidas } = await supabaseClient
            .from('citas_cliente')
            .select('id, fecha_cita, hora_cita, estatus_cita, mensaje_oferta, cliente_id, solicitudes_publicacion(titulo, inventario_publico(id))')
            .eq('vendedor_id', session.user.id)
            .neq('estatus_cita', 'Cancelada')
            .order('fecha_cita', { ascending: true });

        if (!citasRecibidas || citasRecibidas.length === 0) {
            recibidasContainer.innerHTML = `<div class="col-12 text-center py-4 bg-light rounded shadow-sm text-muted">Aún no tienes interesados en tus propiedades.</div>`;
        } else {
            // Buscamos info de los clientes (nombre, teléfono y FOTO)
            const clienteIds = [...new Set(citasRecibidas.map(c => c.cliente_id))];
            const { data: perfilesClientes } = await supabaseClient
                .from('perfiles')
                .select('id, nombre_completo, telefono, avatar_url') // Agregamos avatar_url
                .in('id', clienteIds);

            recibidasContainer.innerHTML = citasRecibidas.map(cita => {
                const clienteInfo = perfilesClientes?.find(p => p.id === cita.cliente_id) || { nombre_completo: 'Usuario', avatar_url: null };
                const casaTitulo = cita.solicitudes_publicacion?.titulo || 'Propiedad';
                const invPublicoId = cita.solicitudes_publicacion?.inventario_publico?.[0]?.id;
                
                // Lógica de Foto de Perfil
                const inicial = clienteInfo.nombre_completo.charAt(0).toUpperCase();
                const avatarHTML = clienteInfo.avatar_url 
                    ? `<img src="${clienteInfo.avatar_url}" class="rounded-circle border me-2 object-fit-cover" width="30" height="30">`
                    : `<div class="bg-secondary text-white rounded-circle d-inline-flex justify-content-center align-items-center me-2" width="30" height="30" style="width:30px; height:30px; font-size: 12px; font-weight: bold;">${inicial}</div>`;

                let botones = '';
                if (cita.estatus_cita === 'Pendiente') {
                    botones = `
                        <button onclick="confirmarCitaPropietario('${cita.id}')" class="btn btn-sm btn-success w-100 mb-1">Confirmar Visita</button>
                        <button onclick="rechazarCitaPropietario('${cita.id}')" class="btn btn-sm btn-outline-danger w-100">Rechazar</button>`;
                } else if (cita.estatus_cita === 'Confirmada') {
                    botones = `<span class="badge bg-success w-100 py-2">Visita Confirmada</span>`;
                } else if (cita.estatus_cita === 'Oferta Recibida') {
                    const safeMsg = cita.mensaje_oferta ? cita.mensaje_oferta.replace(/'/g, "\\'") : 'Sin mensaje';
                    botones = `<button onclick="abrirModalOfertaPropietario('${cita.id}', '${clienteInfo.nombre_completo}', '${casaTitulo.replace(/'/g, "\\'")}', '${safeMsg}')" class="btn btn-sm btn-info w-100 fw-bold shadow-sm"><i class="bi bi-envelope-paper"></i> Revisar Oferta</button>`;
                } else if (cita.estatus_cita === 'Trato Cerrado' || cita.estatus_cita === 'Oferta Rechazada') {
                    const numeroLimpio = clienteInfo.telefono ? clienteInfo.telefono.replace(/[^0-9]/g, '') : '';
                    botones = (cita.estatus_cita === 'Trato Cerrado' && numeroLimpio) 
                        ? `<a href="https://wa.me/52${numeroLimpio}" target="_blank" class="btn btn-sm btn-success w-100 py-2"><i class="bi bi-whatsapp"></i> Contactar</a>` 
                        : `<span class="badge bg-dark w-100 py-2">${cita.estatus_cita}</span>`;
                }

                return `
                <div class="col-12 mb-2">
                    <div class="p-3 bg-white border-start border-4 border-success shadow-sm rounded d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <div>
                            <a href="detalle.html?id=${invPublicoId}" class="text-decoration-none text-dark hover-primary d-block mb-1">
                                <strong>${casaTitulo}</strong> <i class="bi bi-link-45deg small"></i>
                            </a>
                            
                            <a href="vendedor.html?id=${clienteInfo.id}" class="text-decoration-none d-flex align-items-center group small text-muted">
                                ${avatarHTML}
                                <span class="hover-primary">Interesado: ${clienteInfo.nombre_completo}</span>
                            </a>
                            
                            <div class="small text-muted mt-1"><i class="bi bi-clock me-1"></i> ${cita.fecha_cita} | ${cita.hora_cita}</div>
                        </div>
                        <div class="d-flex align-items-center gap-2" style="min-width: 190px;">
                            <div class="flex-grow-1">${botones}</div>
                            <button onclick="eliminarCitaAdmin('${cita.id}')" class="btn btn-outline-danger border-0 p-1" title="Finalizar este registro">
                                <i class="bi bi-x-lg fs-5"></i>
                            </button>
                        </div>
                    </div>
                </div>`;
            }).join('');
        }
    }

    // --- 3. Cargar MIS CITAS COMO COMPRADOR ---
    const { data: citas, error: errCitas } = await supabaseClient
        .from('citas_cliente')
        .select(`
            id, 
            fecha_cita, 
            hora_cita, 
            estatus_cita, 
            respuesta_admin,
            mensaje_admin,
            solicitudes_publicacion(titulo)
        `)
        .eq('cliente_id', session.user.id)
        .order('fecha_cita', { ascending: true });

    if (errCitas) {
        citasContainer.innerHTML = `<div class="alert alert-danger">Error al cargar citas.</div>`;
    } else if (!citas || citas.length === 0) {
        citasContainer.innerHTML = `
            <div class="text-center py-5 dashboard-card border-0 bg-white shadow-sm rounded">
                <i class="bi bi-calendar-x display-4 text-muted mb-3 d-block"></i>
                <h6 class="text-muted">Aún no tienes citas programadas.</h6>
                <a href="index.html" class="btn btn-sm btn-primary-custom mt-2">Agendar una visita</a>
            </div>`;
    } else {
        citasContainer.innerHTML = citas.map(cita => {
            const nombreCasa = cita.solicitudes_publicacion?.titulo || 'Propiedad';
            const hora = cita.hora_cita ? cita.hora_cita.substring(0, 5) : '--:--';
            
            let badgeCls = 'bg-warning text-dark'; 
            let textoEstatus = cita.estatus_cita; 
            if (cita.estatus_cita === 'Confirmada') badgeCls = 'bg-success'; 
            if (cita.estatus_cita === 'Cancelada') badgeCls = 'bg-danger';  
            if (cita.estatus_cita === 'Oferta Recibida') badgeCls = 'bg-info text-dark';
            if (cita.estatus_cita === 'Contraoferta Recibida') badgeCls = 'bg-warning text-dark';
            if (cita.estatus_cita === 'Trato Cerrado') {
                badgeCls = 'bg-primary text-white';
                // Cambiamos el texto para que diga el "Propietario" y no Innova
                textoEstatus = 'Trato cerrado: El propietario de la casa se pondrá en contacto contigo.';
            }
            
            let btnReagendar = '';
            let alertaMotivoCita = '';
            if (cita.estatus_cita === 'Rechazada') {
                badgeCls = 'bg-danger text-white';
                const motivo = cita.mensaje_admin || cita.respuesta_admin; 
                
                if (motivo) {
                    alertaMotivoCita = `
                        <div class="alert alert-danger mt-2 mb-0 p-2 text-start shadow-sm" style="border-left: 4px solid #dc3545; font-size: 0.85rem;">
                            <strong><i class="bi bi-info-circle"></i> Motivo:</strong> ${motivo}
                        </div>
                    `;
                }

                btnReagendar = `
                    <button onclick="abrirModalReagendar('${cita.id}', '${nombreCasa.replace(/'/g, "\\'")}')" class="btn btn-sm btn-primary fw-bold w-100 shadow-sm mt-2">
                        <i class="bi bi-calendar-plus"></i> Reagendar Cita
                    </button>
                `;
            }
            
            const btnCancelar = (cita.estatus_cita === 'Pendiente')
                ? `<button onclick="cancelarCita('${cita.id}')" class="btn btn-sm btn-outline-danger w-100">Cancelar Cita</button>` 
                : '';

            const btnOferta = (cita.estatus_cita === 'Confirmada')
                ? `<button onclick="hacerOferta('${cita.id}', '${nombreCasa.replace(/'/g, "\\'")}')" class="btn btn-sm btn-primary fw-bold w-100">
                    <i class="bi bi-currency-dollar"></i> Hacer Oferta
                   </button>` 
                : '';

            const btnRevisarContra = (cita.estatus_cita === 'Contraoferta Recibida')
                ? `<button onclick="abrirModalNegociacion('${cita.id}', '${nombreCasa.replace(/'/g, "\\'")}', '${(cita.respuesta_admin || '').replace(/'/g, "\\'")}')" 
                    class="btn btn-sm btn-warning fw-bold w-100 shadow-sm">
                    <i class="bi bi-chat-dots-fill"></i> Revisar Contraoferta
                   </button>`
                : '';

            // --- AQUÍ SE AGREGA EL BOTÓN DE LIMPIEZA (X) ---
            return `
            <div class="appointment-card d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-3 p-3 bg-white rounded shadow-sm border-start border-4 border-warning">
                <div class="d-flex align-items-center w-100">
                    <div class="me-4 text-center border-end pe-3">
                        <span class="appointment-time d-block text-dark fw-bold" style="font-size: 1.1rem;">${hora}</span>
                        <small class="text-muted">${cita.fecha_cita}</small>
                    </div>
                    <div class="flex-grow-1">
                        <h5 class="font-serif mb-1" style="font-size: 1rem;">${nombreCasa}</h5>
                        <p class="mb-0 small text-muted"><i class="bi bi-person-badge"></i> Propietario Directo</p>
                        <span class="badge ${badgeCls} mt-2 text-wrap" style="font-size: 0.7rem; max-width: 250px; text-align: left;">
                            ${textoEstatus || 'Pendiente'}
                        </span>
                        ${alertaMotivoCita} 
                    </div>
                </div>
                <div class="d-flex flex-column gap-2 mt-3 mt-md-0" style="min-width: 170px;">
                    ${btnCancelar}
                    ${btnOferta}
                    ${btnRevisarContra}
                    ${btnReagendar} 
                    
                    <button onclick="eliminarCitaComprador('${cita.id}')" class="btn btn-sm btn-light border text-muted w-100 mt-1" title="Quitar de mi lista">
                        <i class="bi bi-x-lg me-1"></i> 
                    </button>
                </div>
            </div>`;
        }).join('');
    }

    // --- 4. Cargar MIS FAVORITOS ---
    const { data: favoritos, error: errFav } = await supabaseClient
        .from('favoritos')
        .select(`
            id, 
            inventario_publico(
                id, 
                solicitudes_publicacion(titulo, precio)
            )
        `)
        .eq('usuario_id', session.user.id);

    if (errFav) {
        favContainer.innerHTML = `<li class="list-group-item text-danger">Error al cargar favoritos.</li>`;
    } else if (!favoritos || favoritos.length === 0) {
        favContainer.innerHTML = `<li class="list-group-item text-muted text-center py-4">Aún no tienes favoritos.</li>`;
    } else {
        favContainer.innerHTML = favoritos.map(fav => {
            const prop = fav.inventario_publico?.solicitudes_publicacion;
            const propertyId = fav.inventario_publico?.id; 
            
            return `
            <li class="list-group-item px-0 d-flex justify-content-between align-items-center border-0 border-bottom">
                <div class="d-flex align-items-center">
                    <div class="bg-light p-2 rounded me-3 text-primary-custom"><i class="bi bi-house-heart"></i></div>
                    <div>
                        <h6 class="mb-0 font-serif small fw-bold text-dark">${prop?.titulo || 'Desconocido'}</h6>
                        <small class="text-muted">$${prop?.precio || '0'} MXN</small>
                    </div>
                </div>
                <div class="d-flex align-items-center">
                    <a href="detalle.html?id=${propertyId}" class="btn btn-sm btn-outline-dark me-2 py-1 px-3" style="font-size: 0.75rem;">
                        Ver detalles
                    </a>
                    <button onclick="eliminarFavorito('${fav.id}')" class="btn btn-sm text-danger p-0" title="Eliminar favorito">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </li>`;
        }).join('');
    }
}
// ==========================================
// --- 11. LÓGICA DE DETALLES (FIX: CITAS Y BANNERS) ---
// ==========================================

async function loadPropertyDetails(id) {
    let prop = null;
    let fotos = [];

    try {
        // 1. Consulta a Supabase (AÑADIMOS 'estatus_revision' para saber si está vendida)
        const { data: item, error } = await supabaseClient
            .from('inventario_publico')
            .select(`
                *,
                solicitudes_publicacion (
                    id, titulo, precio, descripcion, ubicacion, imagenes, propietario_id,
                    tipo_operacion, tipo_inmueble, habitaciones, banos, estacionamiento, estatus_revision,
                    perfiles (id, nombre_completo, correo, avatar_url)
                )
            `)
            .eq('id', id)
            .single();

        if (error || !item) throw new Error("Propiedad no encontrada en el catálogo público.");
        
        prop = item.solicitudes_publicacion;

        // --- LA MAGIA: REDIRECCIÓN AUTOMÁTICA A VENDIDA.HTML SIN BUCLES INFINITOS ---
        // Verificamos si está vendida Y además revisamos que NO estemos ya dentro de vendida.html
        if (prop.estatus_revision === 'Vendida' && !window.location.href.includes('vendida.html')) {
            window.location.href = `vendida.html?id=${id}`;
            return; // Detenemos el código aquí para que no marque errores en el catálogo
        }
        // ---------------------------------------------------------

        currentSolicitudId = prop.id; 
        fotos = prop.imagenes || [];
        const vendedor = prop.perfiles;

        // 2. Inyectar textos básicos y Badges
        const tituloElem = document.getElementById('detalle-titulo');
        if(tituloElem) tituloElem.innerText = prop.titulo;

        const precioElem = document.getElementById('detalle-precio');
        if(precioElem) precioElem.innerText = `$${prop.precio} MXN`;

        const descElem = document.getElementById('detalle-descripcion');
        if(descElem) descElem.innerText = prop.descripcion || 'Sin descripción detallada.';
        
        // Badge de Operación (Venta/Renta)
        const badgeOperacion = prop.tipo_operacion === 'Renta' ? 'bg-success' : 'bg-primary';
        if(tituloElem) {
            tituloElem.innerHTML += ` <span class="badge ${badgeOperacion} fs-6 ms-2 align-middle">${prop.tipo_operacion}</span>`;
        }

        const ubicacionElem = document.getElementById('detalle-ubicacion');
        if (ubicacionElem) {
            ubicacionElem.innerText = prop.ubicacion || 'Ubicación pendiente de verificar';
        }

        // --- 3. SECCIÓN: ICONOS TÉCNICOS (Habitaciones, Baños, etc.) ---
        const iconsContainer = document.getElementById('iconos-propiedad');
        if (iconsContainer) {
            iconsContainer.innerHTML = `
                <div class="row g-3 py-4 border-top border-bottom my-4 text-center bg-white rounded-4 shadow-sm">
                    <div class="col-3 border-end">
                        <i class="bi bi-house-door text-primary fs-3 d-block mb-1"></i>
                        <span class="small fw-bold text-muted text-uppercase" style="font-size: 0.65rem;">Tipo</span>
                        <p class="mb-0 fw-bold small">${prop.tipo_inmueble || 'Casa'}</p>
                    </div>
                    <div class="col-3 border-end">
                        <i class="bi bi-door-open text-primary fs-3 d-block mb-1"></i>
                        <span class="small fw-bold text-muted text-uppercase" style="font-size: 0.65rem;">Hab.</span>
                        <p class="mb-0 fw-bold small">${prop.habitaciones || 0}</p>
                    </div>
                    <div class="col-3 border-end">
                        <i class="bi bi-droplet text-primary fs-3 d-block mb-1"></i>
                        <span class="small fw-bold text-muted text-uppercase" style="font-size: 0.65rem;">Baños</span>
                        <p class="mb-0 fw-bold small">${prop.banos || 0}</p>
                    </div>
                    <div class="col-3">
                        <i class="bi bi-p-circle text-primary fs-3 d-block mb-1"></i>
                        <span class="small fw-bold text-muted text-uppercase" style="font-size: 0.65rem;">Cochera</span>
                        <p class="mb-0 fw-bold small">${prop.estacionamiento || 0}</p>
                    </div>
                </div>
            `;
        }

        // --- 4. LÓGICA DEL VENDEDOR (CON FOTO REAL MAMONA) ---
        const ownerContainer = document.getElementById('vendedor-link-container');
        if (ownerContainer && vendedor) {
            const fotoUrl = vendedor.avatar_url;
            const inicial = vendedor.nombre_completo.charAt(0).toUpperCase();

            ownerContainer.innerHTML = `
                <div class="p-3 border rounded-4 bg-white shadow-sm mt-4">
                    <p class="text-muted mb-2 small text-uppercase fw-bold" style="letter-spacing: 1px;">Publicado por:</p>
                    <a href="vendedor.html?id=${vendedor.id}" class="text-decoration-none d-flex align-items-center group">
                        ${fotoUrl 
                            ? `<img src="${fotoUrl}" class="rounded-circle me-3 shadow-sm object-fit-cover" style="width:50px; height:50px; border: 2px solid #eee;">`
                            : `<div class="bg-dark text-white rounded-circle d-flex justify-content-center align-items-center me-3 shadow-sm" style="width:50px; height:50px; font-size:20px; font-weight: bold;">${inicial}</div>`
                        }
                        <div>
                            <span class="fw-bold text-dark d-block mb-0" style="font-size: 1.1rem;">${vendedor.nombre_completo}</span>
                            <span class="text-primary small">Ver perfil del agente <i class="bi bi-arrow-right-short"></i></span>
                        </div>
                    </a>
                </div>
            `;
        }

        // 5. Configurar Galería
        const mainImg = document.getElementById('detalle-img');
        const thumbContainer = document.getElementById('thumbnails-container');

        if (mainImg && thumbContainer) {
            if (fotos.length > 0) {
                mainImg.src = fotos[0];
                mainImg.onclick = () => openImageModal(mainImg.src);

                thumbContainer.innerHTML = fotos.map((url, index) => `
                    <div class="thumb-item shadow-sm" style="min-width: 100px; height: 70px; cursor: pointer; opacity: ${index === 0 ? '1' : '0.6'}">
                        <img src="${url}" 
                             class="w-100 h-100 object-fit-cover rounded border ${index === 0 ? 'border-primary' : ''}" 
                             onclick="cambiarFotoPrincipal('${url}', this)">
                    </div>
                `).join('');
            } else {
                mainImg.src = "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200";
                thumbContainer.innerHTML = '';
            }
        }

        // 6. Control de visibilidad
        const loadingElem = document.getElementById('detalle-loading');
        const contentElem = document.getElementById('detalle-content');
        
        if(loadingElem) loadingElem.classList.add('d-none');
        if(contentElem) contentElem.classList.remove('d-none');

    } catch (err) {
        console.error("Error al cargar detalles:", err);
        const loadingElem = document.getElementById('detalle-loading');
        if(loadingElem) {
            loadingElem.innerHTML = `
                <div class="container text-center mt-5">
                    <div class="alert alert-danger d-inline-block px-5 shadow-sm">
                        <h3 class="mb-2">Error: ${err.message}</h3>
                        <p class="mb-0">La propiedad podría haber sido retirada o está en revisión.</p>
                    </div>
                    <br>
                    <a href="index.html" class="btn btn-dark mt-3 px-4 shadow-sm">Volver al catálogo</a>
                </div>`;
        }
    }
}

// --- FUNCIONES AUXILIARES ---
function openImageModal(imgUrl) {
    const modalImage = document.getElementById('modal-image');
    const imageModal = new bootstrap.Modal(document.getElementById('imageModal'));
    modalImage.src = imgUrl;
    imageModal.show();
}

window.cambiarFotoPrincipal = function(url, element) {
    const mainImg = document.getElementById('detalle-img');
    mainImg.style.opacity = '0.5';
    setTimeout(() => {
        mainImg.src = url;
        mainImg.style.opacity = '1';
    }, 150);

    document.querySelectorAll('.thumb-item img').forEach(img => {
        img.classList.remove('border-primary');
        img.parentElement.style.opacity = '0.6';
    });
    element.classList.add('border-primary');
    element.parentElement.style.opacity = '1';
};


function setupAgendarForm() {
    const form = document.getElementById('form-agendar');
    if (!form) return;

    form.onsubmit = async (e) => {
        e.preventDefault();
        const msgDiv = document.getElementById('action-message');
        const btn = document.getElementById('btn-agendar');
        
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            msgDiv.className = "alert alert-warning small text-center d-block";
            msgDiv.innerHTML = "Debes <a href='login.html' class='alert-link'>iniciar sesión</a> para agendar.";
            return;
        }

        btn.disabled = true;
        btn.innerText = "Agendando...";

        // --- 1. LO NUEVO: Buscamos quién es el dueño de la casa ---
        const { data: propInfo } = await supabaseClient
            .from('solicitudes_publicacion')
            .select('propietario_id')
            .eq('id', currentSolicitudId)
            .single();

        const idDelDueno = propInfo ? propInfo.propietario_id : null;

        // --- 2. Insertamos la cita asignándole el vendedor_id ---
        const { error } = await supabaseClient
            .from('citas_cliente')
            .insert([{
                cliente_id: session.user.id,
                vendedor_id: idDelDueno, // <-- ESTO CONECTA AL COMPRADOR CON EL DUEÑO
                propiedad_id: currentSolicitudId, 
                fecha_cita: document.getElementById('cita-fecha').value,
                hora_cita: document.getElementById('cita-hora').value,
                estatus_cita: 'Pendiente'
            }]);

        if (error) {
            console.error("Error Supabase:", error);
            msgDiv.className = "alert alert-danger small text-center d-block";
            msgDiv.innerText = "Error al agendar: " + error.message;
        } else {
            msgDiv.className = "alert alert-success small text-center d-block";
            msgDiv.innerText = "¡Cita agendada! El propietario de la casa confirmará pronto.";
            form.reset();
        }
        
        btn.disabled = false;
        btn.innerText = "Agendar Visita Físicamente";
    };
}

// ==========================================
// --- LÓGICA DE FAVORITOS INTELIGENTE (A PRUEBA DE BALAS) ---
// ==========================================
// ==========================================
// --- LÓGICA DE FAVORITOS INTELIGENTE ---
// ==========================================

function setupFavoritosListener() {
    checkFavoritoStatus(); // Solo revisamos el estado al entrar a la página
}

// 1. Revisa si la propiedad ya está en los favoritos
async function checkFavoritoStatus() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return; 

    const { data, error } = await supabaseClient
        .from('favoritos')
        .select('id')
        .eq('usuario_id', session.user.id)
        .eq('propiedad_id', currentPropertyId) // <--- CORRECCIÓN 1: Usar ID del Inventario
        .maybeSingle(); // <--- CORRECCIÓN 2: Evita el error 406 si no hay datos

    setFavoritoBtnState(!!data); 
}

// 2. Cambia la apariencia del botón (corazón lleno/vacío)
function setFavoritoBtnState(isFav) {
    const favBtn = document.getElementById('btn-guardar-favorito') || document.querySelector('[onclick*="guardarFavorito"]');
    if (!favBtn) return;

    if (isFav) {
        favBtn.innerHTML = '<i class="bi bi-heart-fill text-danger me-2"></i> Quitar de favoritos';
        favBtn.classList.remove('btn-outline-dark');
        favBtn.classList.add('btn-outline-danger'); 
        favBtn.setAttribute('data-isfav', 'true');
    } else {
        favBtn.innerHTML = '<i class="bi bi-heart me-2"></i> Guardar en favoritos';
        favBtn.classList.remove('btn-outline-danger');
        favBtn.classList.add('btn-outline-dark'); 
        favBtn.setAttribute('data-isfav', 'false');
    }
}

// 3. El interruptor (CORRECCIÓN 3: Formato clásico para que tu HTML no truene)
async function guardarFavorito() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return alert("Inicia sesión para guardar favoritos.");

    const favBtn = document.getElementById('btn-guardar-favorito') || document.querySelector('[onclick*="guardarFavorito"]');
    
    let isFav = false;
    if (favBtn) {
        isFav = favBtn.getAttribute('data-isfav') === 'true';
        favBtn.disabled = true; 
    }

    if (isFav) {
        // SI YA ES FAVORITO -> LO BORRAMOS
        const { error } = await supabaseClient
            .from('favoritos')
            .delete()
            .eq('usuario_id', session.user.id)
            .eq('propiedad_id', currentPropertyId); // Usar ID del Inventario

        if (error) alert("Error al quitar: " + error.message);
        else setFavoritoBtnState(false); 
    } else {
        // SI NO ES FAVORITO -> LO AGREGAMOS
        const { error } = await supabaseClient
            .from('favoritos')
            .insert([{ 
                usuario_id: session.user.id, 
                propiedad_id: currentPropertyId // Usar ID del Inventario
            }]);

        if (error) {
            console.error("Error de Supabase:", error);
            if (error.code === '23505') setFavoritoBtnState(true);
            else alert("Hubo un error: " + error.message);
        } else {
            setFavoritoBtnState(true); 
        }
    }
    
    if (favBtn) favBtn.disabled = false; 
}

// --- 12. LÓGICA DE PUBLICACIÓN DE PROPIEDAD (CON TODOS LOS FILTROS) ---
function setupPublicarForm() {
    const form = document.getElementById('form-publicar');
    if (!form) return;

    form.onsubmit = async (e) => {
        e.preventDefault();
        
        const msgDiv = document.getElementById('pub-message');
        const btn = document.getElementById('btn-enviar');
        const fileInput = document.getElementById('pub-fotos'); 
        
        // 1. Verificamos sesión
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            msgDiv.className = "alert alert-warning d-block";
            msgDiv.innerHTML = "Tu sesión expiró o no has <a href='login.html' class='alert-link'>iniciado sesión</a>.";
            return;
        }

        btn.disabled = true;
        btn.innerText = "Subiendo imágenes..."; 
        msgDiv.classList.add('d-none');

        try {
            // A. SUBIR LAS FOTOS PRIMERO
            const archivos = fileInput.files;
            let urlsImagenes = [];

            if (archivos.length > 0) {
                const promesasSubida = Array.from(archivos).map(archivo => subirFotoASupabase(archivo, session.user.id));
                urlsImagenes = await Promise.all(promesasSubida);
            }

            // B. RECOLECTAR DATOS DEL FORMULARIO (Incluyendo los nuevos campos)
            const titulo = document.getElementById('pub-titulo').value;
            const precio = document.getElementById('pub-precio').value;
            const ubicacion = document.getElementById('pub-ubicacion').value;
            const descripcion = document.getElementById('pub-descripcion').value;
            
            // --- NUEVOS CAMPOS ---
            const tipoInmueble = document.getElementById('pub-tipo-inmueble').value;
            const tipoOperacion = document.getElementById('pub-tipo-operacion').value;
            const habitaciones = parseInt(document.getElementById('pub-habitaciones').value) || 0;
            const banos = parseInt(document.getElementById('pub-banos').value) || 0;
            const estacionamiento = parseInt(document.getElementById('pub-estacionamiento').value) || 0;

            btn.innerText = "Guardando solicitud...";

            // C. INSERTAR EN LA TABLA CON CAMPOS SEPARADOS
            const { error } = await supabaseClient
                .from('solicitudes_publicacion')
                .insert([{
                    propietario_id: session.user.id,
                    titulo: titulo,
                    precio: precio,
                    ubicacion: ubicacion,
                    descripcion: descripcion,
                    imagenes: urlsImagenes,
                    // Datos técnicos añadidos
                    tipo_inmueble: tipoInmueble,
                    tipo_operacion: tipoOperacion,
                    habitaciones: habitaciones,
                    banos: banos,
                    estacionamiento: estacionamiento,
                    estatus_revision: 'Pendiente'
                }]);

            if (error) throw error;

            // Éxito
            msgDiv.className = "alert alert-success d-block text-center shadow-sm";
            msgDiv.innerHTML = `
                <i class="bi bi-check-circle-fill me-2"></i>
                <strong>¡Propiedad enviada con éxito!</strong><br>
                El equipo de INNOVA revisará los detalles y te notificará cuando esté activa.
            `;
            
            form.reset();
            
            // Redirección suave
            setTimeout(() => {
                window.location.href = 'cliente.html';
            }, 3000);

        } catch (err) {
            console.error("Error en el proceso de publicación:", err);
            msgDiv.className = "alert alert-danger d-block";
            msgDiv.innerText = "Hubo un problema al guardar: " + err.message;
            btn.disabled = false;
            btn.innerText = "Enviar a Revisión";
        }
    };
}

// --- FUNCIÓN AUXILIAR PARA SUBIR AL STORAGE ---
async function subirFotoASupabase(archivo, userId) {
    // Generamos una ruta única
    const extension = archivo.name.split('.').pop();
    const nombreLimpio = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const rutaArchivo = `${userId}/${nombreLimpio}.${extension}`;

    // 1. Subir el archivo físico
    const { data, error } = await supabaseClient.storage
        .from('propiedades-fotos')
        .upload(rutaArchivo, archivo);

    if (error) throw new Error("Fallo al subir imagen: " + error.message);

    // 2. Obtener la URL pública
    const { data: { publicUrl } } = supabaseClient.storage
        .from('propiedades-fotos')
        .getPublicUrl(rutaArchivo);

    return publicUrl;
}

// --- 13. FUNCIÓN DEL ADMIN PARA APROBAR SOLICITUDES ---
async function aprobarSolicitud(solicitudId) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return alert("Error: Tu sesión expiró.");

    if(!confirm("¿Estás seguro de aprobar esta propiedad?")) return;

    try {
        // 1. OBLIGATORIO: Cambiamos el estatus a 'Aprobada' en la tabla de solicitudes
        // Esto es lo que hace que desaparezca de "Solicitudes Pendientes"
        const { error: errUpdate } = await supabaseClient
            .from('solicitudes_publicacion')
            .update({ estatus_revision: 'Aprobada' })
            .eq('id', solicitudId);

        if (errUpdate) throw new Error("No se pudo actualizar el estado de la solicitud.");

        // 2. Revisamos si ya existe en el inventario para no duplicar de nuevo
        const { data: yaExiste } = await supabaseClient
            .from('inventario_publico')
            .select('id')
            .eq('solicitud_id', solicitudId)
            .maybeSingle();

        if (!yaExiste) {
            // 3. SOLO SI NO EXISTE, la insertamos en el inventario público
            const { error: errInsert } = await supabaseClient
                .from('inventario_publico')
                .insert([{
                    solicitud_id: solicitudId,
                    admin_id: session.user.id,
                    categoria_id: 1 
                }]);

            if (errInsert) throw new Error("Error al insertar en el inventario público.");
            alert("¡Propiedad aprobada y publicada!");
        } else {
            // Si ya existía, solo avisamos que ya se quitó de pendientes
            alert("La propiedad ya estaba en inventario. Se ha marcado como aprobada en el sistema.");
        }

        window.location.reload();

    } catch (err) {
        console.error("Error en aprobación:", err);
        alert(err.message);
    }
}

async function rechazarSolicitud(solicitudId) {
    // Generamos el reporte justo antes de mandar el rechazo
    generarComentariosReporte();

    const confirmacion = confirm("¿Confirmar rechazo con el siguiente reporte?\n\n" + reporteComentarios);
    if (!confirmacion) return;

    try {
        const { error } = await supabaseClient
            .from('solicitudes_publicacion')
            .update({ 
                estatus_revision: 'Rechazada',
                motivo_rechazo: reporteComentarios // Guardamos el reporte aquí
            })
            .eq('id', solicitudId);

        if (error) throw error;

        alert("Propiedad rechazada. El usuario ya puede ver sus errores en su panel.");
        location.reload();
    } catch (err) {
        alert("Error al rechazar: " + err.message);
    }
}

// --- 15. FUNCIÓN PARA ELIMINAR FAVORITOS ---
async function eliminarFavorito(favoritoId) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return alert("Debes iniciar sesión.");

    if (!confirm("¿Quieres eliminar esta propiedad de tus favoritos?")) return;

    const { error } = await supabaseClient
        .from('favoritos')
        .delete()
        .eq('id', favoritoId);

    if (error) {
        alert("Error al eliminar: " + error.message);
    } else {
        loadClienteDashboard();
    }
}

// --- 16. FUNCIÓN PARA CANCELAR CITAS ---
async function cancelarCita(citaId) {
    if (!confirm("¿Estás seguro de que quieres cancelar esta cita?")) return;

    const { error } = await supabaseClient
        .from('citas_cliente')
        .update({ estatus_cita: 'Cancelada' })
        .eq('id', citaId);

    if (error) {
        alert("Error al cancelar la cita: " + error.message);
    } else {
        alert("Cita cancelada correctamente.");
        loadClienteDashboard(); 
    }
}

// --- 17. FUNCIÓN PARA QUE EL PROPIETARIO CONFIRME CITAS (P2P) ---
async function confirmarCitaPropietario(citaId) {
    const { error } = await supabaseClient
        .from('citas_cliente')
        .update({ estatus_cita: 'Confirmada' })
        .eq('id', citaId);

    if (error) {
        alert("Error al confirmar la cita: " + error.message);
    } else {
        alert("¡Cita confirmada! El interesado verá el cambio en su panel.");
        loadClienteDashboard(); // <-- Ahora recargamos el panel del cliente
    }
}

// (Opcional pero recomendado para evitar fallos de HTML)
// Aseguramos que la función esté disponible globalmente para los botones
window.confirmarCitaPropietario = confirmarCitaPropietario;

/// Variable global para recordar qué cita estamos rechazando
let citaIdPendienteRechazar = null;

// --- 1. FUNCIÓN QUE ABRE EL MENÚ PARA ESCRIBIR EL MOTIVO (AHORA PARA EL PROPIETARIO) ---
window.rechazarCitaPropietario = function(citaId) { 
    citaIdPendienteRechazar = citaId;
    
    // Si no existe el modal en el HTML, lo inyectamos al vuelo
    if (!document.getElementById('modalRechazarCitaPropietario')) {
        const modalHTML = `
            <div class="modal fade" id="modalRechazarCitaPropietario" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content shadow-lg border-0">
                        <div class="modal-header border-0 pb-0">
                            <h5 class="modal-title w-100 text-center fw-bold fs-4 text-dark">Rechazar Solicitud</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body text-center pt-2 pb-4 px-4">
                            <p class="text-muted mb-3">Escribe el motivo por el cual estás rechazando esta visita. El interesado lo verá en su panel.</p>
                            
                            <textarea id="motivoRechazoInput" class="form-control mb-4" rows="3" placeholder="Ej: Lo lamento, ya tengo otra cita agendada a esa hora..."></textarea>
                            
                            <button class="btn btn-danger w-100 py-3 fw-bold fs-5 shadow-sm" onclick="ejecutarRechazoCitaPropietario()">
                                Confirmar y Rechazar
                            </button>
                            
                            <button class="btn btn-light mt-3 text-secondary" data-bs-dismiss="modal">
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // Limpiamos el cuadro de texto cada vez que se abre el modal
    document.getElementById('motivoRechazoInput').value = '';
    
    // Abrimos el modal con Bootstrap
    const modalOpciones = new bootstrap.Modal(document.getElementById('modalRechazarCitaPropietario'));
    modalOpciones.show();
};

// --- 2. FUNCIÓN QUE GUARDA EL MOTIVO EN SUPABASE ---
window.ejecutarRechazoCitaPropietario = async function() {
    const motivo = document.getElementById('motivoRechazoInput').value.trim();
    
    // Validamos que el dueño no lo deje en blanco
    if (!motivo) {
        alert("Por favor, escribe un motivo para el rechazo. Es importante para el interesado.");
        return;
    }

    const citaId = citaIdPendienteRechazar;
    if (!citaId) return;

    console.log("Rechazando cita:", citaId, "Motivo:", motivo);

    try {
        // Actualizamos el estatus de la cita y le inyectamos el mensaje
        const { error } = await supabaseClient
            .from('citas_cliente')
            .update({ 
                estatus_cita: 'Rechazada', 
                respuesta_admin: motivo // Guardamos el texto para que el interesado lo lea
            })
            .eq('id', citaId);

        if (error) throw error;

        alert("La cita fue rechazada y el mensaje se envió al interesado.");
        
        // Ocultamos el modal
        const modalEl = document.getElementById('modalRechazarCitaPropietario');
        const modalInstancia = bootstrap.Modal.getInstance(modalEl);
        if (modalInstancia) modalInstancia.hide();

        // Recargamos el panel del cliente
        if (typeof loadClienteDashboard === 'function') {
            loadClienteDashboard();
        } else {
            location.reload();
        }

    } catch (error) {
        console.error("Error al rechazar la cita:", error);
        alert("Hubo un error al conectar con Supabase. Revisa la consola.");
    }
};

// --- 2. FUNCIÓN QUE GUARDA EL MOTIVO EN SUPABASE ---
async function ejecutarRechazoCita() {
    const motivo = document.getElementById('motivoRechazoInput').value.trim();
    
    // Validamos que el admin no lo deje en blanco
    if (!motivo) {
        alert("Por favor, escribe un motivo para el rechazo. Es importante para el cliente.");
        return;
    }

    const citaId = citaIdPendienteRechazar;
    if (!citaId) return;

    console.log("Rechazando cita:", citaId, "Motivo:", motivo);

    try {
        // Actualizamos el estatus de la cita y le inyectamos el mensaje del admin
        const { error } = await supabaseClient
            .from('citas_cliente')
            .update({ 
                estatus_cita: 'Rechazada', // *Asegúrate de que este sea el nombre exacto de tu estatus
                mensaje_admin: motivo      // Guardamos el texto en tu columna mensaje_admin
            })
            .eq('id', citaId);

        if (error) throw error;

        alert("La cita fue rechazada y el mensaje se envió al panel del cliente.");
        
        // Ocultamos el modal
        const modalEl = document.getElementById('modalRechazarCita');
        const modalInstancia = bootstrap.Modal.getInstance(modalEl);
        if (modalInstancia) modalInstancia.hide();

        // Recargamos el panel para actualizar las tarjetas
        if (typeof loadAdminDashboard === 'function') {
            loadAdminDashboard();
        } else {
            location.reload();
        }

    } catch (error) {
        console.error("Error al rechazar la cita:", error);
        alert("Hubo un error al conectar con Supabase. Revisa la consola.");
    }
}

// --- 19. LÓGICA DE CONTROL DE USUARIOS (CON BLOQUEO Y SELECTOR DE ROL) ---
async function loadAdminUsuarios() {
    const tableBody = document.getElementById('admin-usuarios-container');
    if (!tableBody) return;

    // 1. Consulta a Supabase incluyendo 'estado' y 'avatar_url'
    const { data: usuarios, error } = await supabaseClient
        .from('perfiles')
        .select(`
            id, 
            nombre_completo, 
            correo, 
            rol, 
            estado, 
            avatar_url, 
            favoritos(id), 
            citas_cliente(id)
        `);

    if (error) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-danger text-center">Error al cargar usuarios</td></tr>`;
        return;
    }

    // 2. Actualizar KPIs de la parte superior
    document.getElementById('kpi-total-usuarios').innerText = usuarios.length;
    document.getElementById('kpi-total-admins').innerText = usuarios.filter(u => u.rol === 'admin').length;
    document.getElementById('kpi-total-clientes').innerText = usuarios.filter(u => u.rol === 'cliente').length;

    // 3. Renderizar filas de la tabla
    tableBody.innerHTML = usuarios.map(user => {
        const nombre = user.nombre_completo || 'Usuario Nuevo';
        const inicial = nombre.charAt(0).toUpperCase();
        const numFavs = user.favoritos ? user.favoritos.length : 0;
        const numCitas = user.citas_cliente ? user.citas_cliente.length : 0;
        const avatarClass = user.rol === 'admin' ? 'bg-avatar-2' : 'bg-avatar-1';
        
        // LÓGICA DE ESTADO (ACTIVO / BLOQUEADO)
        const estaBloqueado = user.estado === 'bloqueado';
        const estadoTexto = estaBloqueado ? 'Cuenta bloqueada' : 'Cuenta activa';
        const badgeCls = estaBloqueado 
            ? 'bg-danger bg-opacity-10 text-danger border border-danger' 
            : 'bg-success bg-opacity-10 text-success border border-success';
        const badgeTexto = estaBloqueado ? 'Bloqueado' : 'Verificado';

        // --- LÓGICA "MAMONA" DE LA FOTO DE PERFIL ---
        const fotoUrl = user.avatar_url;
        let avatarContenido = '';

        if (fotoUrl) {
            // Si tiene foto, mostramos el img con object-fit para que no se deforme
            avatarContenido = `<img src="${fotoUrl}" class="avatar-circle shadow-sm object-fit-cover ${estaBloqueado ? 'opacity-50' : ''}" style="width: 40px; height: 40px; border-radius: 50%;">`;
        } else {
            // Si no tiene, el div con la inicial de siempre
            avatarContenido = `<div class="avatar-circle ${avatarClass} shadow-sm ${estaBloqueado ? 'opacity-50' : ''}">${inicial}</div>`;
        }

        // Botón dinámico de Bloqueo/Desbloqueo
        const btnBloqueo = estaBloqueado 
            ? `<button onclick="toggleBloqueoUsuario('${user.id}', 'activo', '${nombre}')" class="btn btn-sm btn-outline-success py-1 px-2" title="Desbloquear cuenta"><i class="bi bi-unlock"></i></button>`
            : `<button onclick="toggleBloqueoUsuario('${user.id}', 'bloqueado', '${nombre}')" class="btn btn-sm btn-outline-danger py-1 px-2" title="Bloquear cuenta"><i class="bi bi-slash-circle"></i></button>`;

        const selectorRol = `
            <select class="form-select form-select-sm border-secondary shadow-sm" style="width: 130px;" onchange="cambiarRolUsuario('${user.id}', this.value, '${nombre}')" ${estaBloqueado ? 'disabled' : ''}>
                <option value="cliente" ${user.rol === 'cliente' ? 'selected' : ''}>Cliente</option>
                <option value="admin" ${user.rol === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
        `;

        // Construcción de la fila
        return `
        <tr class="${estaBloqueado ? 'table-danger' : ''}">
            <td class="ps-4"><input class="form-check-input" type="checkbox"></td>
            <td>
                <div class="d-flex align-items-center">
                    <div class="me-3">
                        ${avatarContenido}
                    </div>
                    <div>
                        <h6 class="mb-0 font-serif fw-bold ${estaBloqueado ? 'text-danger' : ''}">${nombre}</h6>
                        <small class="text-muted"><i class="bi bi-envelope"></i> ${user.correo}</small>
                    </div>
                </div>
            </td>
            <td>${selectorRol}</td>
            <td><div class="small ${estaBloqueado ? 'text-danger fw-bold' : 'text-muted'}">${estadoTexto}</div></td>
            <td>
                <div class="small">
                    <span class="text-muted"><i class="bi bi-heart-fill text-danger small"></i> ${numFavs} Favs</span><br>
                    <span class="text-muted"><i class="bi bi-calendar-event text-primary-custom small"></i> ${numCitas} Citas</span>
                </div>
            </td>
            <td><span class="badge ${badgeCls} px-2 py-1">${badgeTexto}</span></td>
            <td class="text-end pe-4">
                <button class="btn btn-sm btn-outline-dark py-1 px-2 me-1" title="Ver Perfil Público" onclick="window.open('vendedor.html?id=${user.id}', '_blank')">
                    <i class="bi bi-person-bounding-box"></i>
                </button>
                ${btnBloqueo}
                <button onclick="eliminarUsuarioTotal('${user.id}', '${nombre}')" class="btn btn-sm btn-danger py-1 px-2 ms-1" title="BORRAR TODO EL PERFIL">
                    <i class="bi bi-trash3-fill"></i>
                </button>
            </td>
        </tr>`;
    }).join('');
}

// --- 20. LÓGICA DE INVENTARIO TOTAL (Actualizada con Vista Previa) ---
async function loadAdminInventario() {
    const tableBody = document.getElementById('admin-inventario-container');
    const footerCount = document.getElementById('inventario-count-footer');
    if (!tableBody) return;

    // A. Agregamos 'imagenes' al select para que la tabla se vea real
    const { data: solicitudes, error } = await supabaseClient
        .from('solicitudes_publicacion')
        .select(`id, titulo, precio, descripcion, estatus_revision, imagenes, inventario_publico(id)`)
        .order('id', { ascending: false });

    if (error) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-danger text-center">Error al cargar el inventario</td></tr>`;
        return;
    }

    footerCount.innerText = `Total de propiedades registradas: ${solicitudes.length}`;

    tableBody.innerHTML = solicitudes.map(sol => {
        // B. Lógica de imagen de portada real
        const fotos = sol.imagenes || [];
        const imgPortada = fotos.length > 0 
            ? fotos[0] 
            : "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=100&q=80";
        
        let badgeCls = 'bg-warning text-dark';
        let statusText = 'EN REVISIÓN';
        let switchChecked = '';
        let switchLabel = 'Pausada';
        let switchLabelCls = 'text-muted';

        if (sol.estatus_revision === 'Aprobada') {
            badgeCls = 'bg-success bg-opacity-10 text-success border border-success';
            statusText = 'PUBLICADA';
            switchChecked = 'checked';
            switchLabel = 'Activa';
            switchLabelCls = 'text-success';
        } else if (sol.estatus_revision === 'Rechazada') {
            badgeCls = 'bg-danger bg-opacity-10 text-danger border border-danger';
            statusText = 'RECHAZADA';
        }

        // C. LÓGICA DE BOTÓN DINÁMICO (PREVIEW VS PÚBLICO)
        const invId = sol.inventario_publico?.[0]?.id;
        let btnVer = '';

        if (sol.estatus_revision === 'Aprobada' && invId) {
            // Si está aprobada, va al detalle público
            btnVer = `<a href="detalle.html?id=${invId}" class="btn btn-sm btn-outline-dark py-1 px-2 me-1" title="Ver en Catálogo Público">
                        <i class="bi bi-eye"></i>
                      </a>`;
        } else {
            // Si está pendiente o rechazada, va al borrador
            btnVer = `<a href="borrador.html?id=${sol.id}" class="btn btn-sm btn-outline-secondary py-1 px-2 me-1" title="Ver Borrador / Previa">
                        <i class="bi bi-file-earmark-medical"></i>
                      </a>`;
        }

        // --- DENTRO DE loadAdminInventario ---
// --- REEMPLAZA EL RETURN DENTRO DEL .map() EN loadAdminInventario ---
return `
<tr>
    <td class="ps-4"><input class="form-check-input" type="checkbox"></td>
    <td class="text-muted fw-bold small">#SOL-${sol.id}</td>
    <td>
        <div class="d-flex align-items-center">
            <img src="${imgPortada}" class="rounded me-3 shadow-sm" style="width: 60px; height: 45px; object-fit: cover;">
            <div>
                <h6 class="mb-0 font-serif fw-bold">${sol.titulo}</h6>
                <small class="text-muted text-truncate d-inline-block" style="max-width: 180px;">${sol.descripcion || 'Sin descripción'}</small>
            </div>
        </div>
    </td>
    <td><span class="badge ${badgeCls} py-2 px-3">${statusText}</span></td>
    <td class="fw-bold text-dark">$${sol.precio}</td>
    <td>
        <div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" ${switchChecked} disabled>
            <label class="form-check-label small ${switchLabelCls} fw-bold ms-1">${switchLabel}</label>
        </div>
    </td>
    <td class="text-end pe-4">
        ${btnVer}
        <button onclick="abrirModalEdicion('${sol.id}')" class="btn btn-sm btn-outline-primary py-1 px-2 me-1" title="Editar como Admin">
            <i class="bi bi-pencil"></i>
        </button>
        <button onclick="eliminarPropiedadTotal('${sol.id}')" class="btn btn-sm btn-outline-danger py-1 px-2" title="Eliminar definitivamente">
            <i class="bi bi-trash"></i>
        </button>
    </td>
</tr>`;
    }).join('');
}

// --- 21. LÓGICA DE REPORTES DINÁMICOS ---
async function loadAdminReportes() {
    const statElement = document.getElementById('stat-activas');
    if (!statElement) return;

    const { count: activas } = await supabaseClient.from('inventario_publico').select('*', { count: 'exact', head: true });
    const { count: usuarios } = await supabaseClient.from('perfiles').select('*', { count: 'exact', head: true });
    const { count: citas } = await supabaseClient.from('citas_cliente').select('*', { count: 'exact', head: true }).eq('estatus_cita', 'Confirmada');
    const { count: rechazadas } = await supabaseClient.from('solicitudes_publicacion').select('*', { count: 'exact', head: true }).eq('estatus_revision', 'Rechazada');
    const { count: pendientes } = await supabaseClient.from('solicitudes_publicacion').select('*', { count: 'exact', head: true }).eq('estatus_revision', 'Pendiente');

    statElement.innerText = activas || 0;
    document.getElementById('stat-usuarios').innerText = usuarios || 0;
    document.getElementById('stat-citas').innerText = citas || 0;
    document.getElementById('stat-rechazadas').innerText = rechazadas || 0;

    renderCharts(activas || 0, pendientes || 0, rechazadas || 0);
}

function renderCharts(activas, pendientes, rechazadas) {
    const colorNavy = '#1a2a3a';
    const colorGold = '#c5a059';
    const colorGray = '#6c757d';

    new Chart(document.getElementById('barChart'), {
        type: 'bar',
        data: {
            labels: ['Propiedades', 'Pendientes', 'Rechazadas'],
            datasets: [{
                label: 'Cantidad Actual',
                data: [activas, pendientes, rechazadas],
                backgroundColor: colorNavy,
                borderRadius: 4
            }]
        }
    });

    new Chart(document.getElementById('doughnutChart'), {
        type: 'doughnut',
        data: {
            labels: ['Activas', 'En Revisión', 'Rechazadas'],
            datasets: [{
                data: [activas, pendientes, rechazadas],
                backgroundColor: [colorNavy, colorGold, colorGray]
            }]
        },
        options: { cutout: '70%' }
    });
}

// --- ELIMINAR DESDE EL PANEL DEL ADMIN ---
async function eliminarPropiedadTotal(id) {
    const confirmacion = confirm("¿Estás 100% seguro? Esta acción borrará la propiedad de las solicitudes, del catálogo público y del servidor permanentemente.");
    if (!confirmacion) return;

    // 1. EXTRAER LAS FOTOS ANTES DE BORRAR
    const { data: sol } = await supabaseClient.from('solicitudes_publicacion').select('imagenes').eq('id', id).single();

    // 2. BORRAMOS DE LA BASE DE DATOS
    const { error } = await supabaseClient.from('solicitudes_publicacion').delete().eq('id', id);

    if (error) {
        console.error("Error al borrar:", error);
        alert("No se pudo borrar la propiedad: " + error.message);
    } else {
        // 3. LIMPIAMOS EL STORAGE FÍSICO
        if (sol && sol.imagenes) await borrarFotosStorage(sol.imagenes);
        
        alert("Propiedad eliminada del sistema y del servidor correctamente.");
        loadAdminInventario(); 
    }
}
// --- 23. FUNCIÓN PARA CAMBIAR EL ROL DE UN USUARIO ---
async function cambiarRolUsuario(userId, nuevoRol, nombreUsuario) {
    if (!confirm(`¿Estás seguro de otorgarle permisos de "${nuevoRol.toUpperCase()}" a ${nombreUsuario}?`)) {
        loadAdminUsuarios(); // Si cancela, recargamos para devolver el select a su estado original
        return;
    }

    const { error } = await supabaseClient
        .from('perfiles')
        .update({ rol: nuevoRol })
        .eq('id', userId);

    if (error) {
        alert("Error al actualizar el rol: " + error.message);
        loadAdminUsuarios(); 
    } else {
        // Mostramos un mensaje de éxito bonito
        alert(`¡Éxito! Ahora ${nombreUsuario} es un ${nuevoRol}.`);
        loadAdminUsuarios(); // Recargamos para actualizar los colores y los KPIs de arriba
    }
}

// --- EFECTO DE NAVEGACIÓN AL HACER SCROLL ---
window.addEventListener('scroll', function() {
    const nav = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        // Cuando bajamos: fondo blanco y sombra para legibilidad
        nav.classList.add('bg-white', 'shadow-sm', 'navbar-light');
        nav.classList.remove('navbar-dark');
    } else {
        // Cuando estamos arriba: volvemos a la transparencia original
        // OJO: Si en detalle.html quieres que SIEMPRE sea blanco, quita este 'else'
        nav.classList.remove('bg-white', 'shadow-sm', 'navbar-light');
    }
});

async function loadBorradorDetails(id) {
    // 1. Consultamos la SOLICITUD y traemos los datos del PERFIL (incluyendo la foto real)
    const { data: sol, error } = await supabaseClient
        .from('solicitudes_publicacion')
        .select(`
            *,
            perfiles (id, nombre_completo, correo, avatar_url)
        `)
        .eq('id', id)
        .single();

    if (error || !sol) {
        document.getElementById('detalle-loading').innerHTML = `
            <div class="alert alert-danger mt-5">
                <h4><i class="bi bi-x-octagon me-2"></i>Error: No se encontró el borrador</h4>
                <p>Es posible que el registro haya sido eliminado o no tengas permisos para verlo.</p>
                <a href="cliente.html" class="btn btn-dark btn-sm">Volver a Mi Panel</a>
            </div>`;
        return;
    }

    currentSolicitudId = sol.id;
    const vendedor = sol.perfiles;

    // 2. Llenar textos básicos
    document.getElementById('detalle-titulo').innerText = sol.titulo;
    document.getElementById('detalle-precio').innerText = `$${sol.precio} MXN`;
    document.getElementById('detalle-descripcion').innerText = sol.descripcion || 'Sin descripción aún.';
    
    const ubicacionElem = document.getElementById('detalle-ubicacion');
    if (ubicacionElem) ubicacionElem.innerText = sol.ubicacion || 'Ubicación pendiente';

    // 3. ICONOS TÉCNICOS (Tipo, Hab, Baños, Cochera)
    const iconosContainer = document.getElementById('iconos-propiedad');
    if (iconosContainer) {
        iconosContainer.innerHTML = `
            <div class="row g-0 py-4 border-top border-bottom my-4 text-center bg-white shadow-sm rounded-4 justify-content-center">
                <div class="col-3 border-end">
                    <i class="bi bi-house-door text-primary-custom fs-3 d-block mb-1"></i>
                    <span class="small fw-bold text-muted text-uppercase" style="font-size: 0.65rem;">Tipo</span>
                    <p class="mb-0 fw-bold small">${sol.tipo_inmueble || 'Casa'}</p>
                </div>
                <div class="col-3 border-end">
                    <i class="bi bi-door-open text-primary-custom fs-3 d-block mb-1"></i>
                    <span class="small fw-bold text-muted text-uppercase" style="font-size: 0.65rem;">Hab.</span>
                    <p class="mb-0 fw-bold small">${sol.habitaciones || 0}</p>
                </div>
                <div class="col-3 border-end">
                    <i class="bi bi-droplet text-primary-custom fs-3 d-block mb-1"></i>
                    <span class="small fw-bold text-muted text-uppercase" style="font-size: 0.65rem;">Baños</span>
                    <p class="mb-0 fw-bold small">${sol.banos || 0}</p>
                </div>
                <div class="col-3">
                    <i class="bi bi-p-circle text-primary-custom fs-3 d-block mb-1"></i>
                    <span class="small fw-bold text-muted text-uppercase" style="font-size: 0.65rem;">Cochera</span>
                    <p class="mb-0 fw-bold small">${sol.estacionamiento || 0}</p>
                </div>
            </div>
        `;
    }

    // 4. ACCESO AL PERFIL CON FOTO REAL "MAMONA"
    const ownerContainer = document.getElementById('vendedor-link-container');
    if (ownerContainer && vendedor) {
        const fotoUrl = vendedor.avatar_url;
        const inicial = vendedor.nombre_completo.charAt(0).toUpperCase();

        ownerContainer.innerHTML = `
            <div class="p-3 border rounded-4 bg-white shadow-sm mt-4">
                <p class="text-muted mb-2 small text-uppercase fw-bold" style="letter-spacing: 1px;">Publicado por:</p>
                <a href="vendedor.html?id=${vendedor.id}" class="text-decoration-none d-flex align-items-center group">
                    ${fotoUrl 
                        ? `<img src="${fotoUrl}" class="rounded-circle me-3 shadow-sm object-fit-cover" style="width:45px; height:45px; border: 2px solid #eee;">`
                        : `<div class="bg-dark text-white rounded-circle d-flex justify-content-center align-items-center me-3 shadow-sm" style="width:45px; height:45px; font-size:18px; font-weight: bold;">${inicial}</div>`
                    }
                    <div>
                        <span class="fw-bold text-dark d-block mb-0" style="font-size: 1.1rem;">${vendedor.nombre_completo}</span>
                        <span class="text-primary-custom small">Ver perfil del agente <i class="bi bi-arrow-right-short"></i></span>
                    </div>
                </a>
            </div>
        `;
    }

    // 5. Galería de fotos
    const fotos = sol.imagenes || [];
    const mainImg = document.getElementById('detalle-img');
    const thumbContainer = document.getElementById('thumbnails-container');

    if (fotos.length > 0) {
        mainImg.src = fotos[0];
        mainImg.onclick = () => openImageModal(mainImg.src);

        thumbContainer.innerHTML = fotos.map((url, index) => `
            <div class="thumb-item shadow-sm" style="min-width: 100px; height: 70px; cursor: pointer; opacity: ${index === 0 ? '1' : '0.6'}">
                <img src="${url}" class="w-100 h-100 object-fit-cover rounded border ${index === 0 ? 'border-primary' : ''}" 
                     onclick="cambiarFotoPrincipal('${url}', this)">
            </div>
        `).join('');
    } else {
        mainImg.src = "https://via.placeholder.com/800x500?text=Sin+Imagen";
        thumbContainer.innerHTML = '';
    }

    // 6. Mostrar contenido
    document.getElementById('detalle-loading').classList.add('d-none');
    document.getElementById('detalle-content').classList.remove('d-none');
}

// ==========================================
// --- FUNCIONES DE CLIENTE: EDITAR Y BORRAR PROPIEDAD ---
// ==========================================

// --- ELIMINAR DESDE EL PANEL DEL CLIENTE ---
async function eliminarPropiedadCliente(id) {
    if (!confirm("¿Estás seguro de eliminar esta propiedad? Se borrará de tus solicitudes y del catálogo si estaba publicada.")) return;

    // 1. EXTRAER LAS FOTOS ANTES DE QUE SE BORRE LA CASA
    const { data: sol } = await supabaseClient.from('solicitudes_publicacion').select('imagenes').eq('id', id).single();

    // 2. BORRAMOS DE LA BASE DE DATOS (El Cascade borra citas y favoritos)
    const { error } = await supabaseClient.from('solicitudes_publicacion').delete().eq('id', id);

    if (error) {
        alert("Error al eliminar: " + error.message);
    } else {
        // 3. SI LA DB SE BORRÓ BIEN, LIMPIAMOS EL STORAGE FÍSICO
        if (sol && sol.imagenes) await borrarFotosStorage(sol.imagenes);
        
        alert("Propiedad y fotografías eliminadas correctamente.");
        loadClienteDashboard(); 
    }
}

let editSolicitudId = null; // Variable para saber qué casa estamos editando

async function abrirModalEdicion(id) {
    editSolicitudId = id;
    fotosABorrarStorage = []; 

    // 1. Traer la información fresca de Supabase
    const { data: sol, error } = await supabaseClient
        .from('solicitudes_publicacion')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !sol) {
        console.error("Error al cargar:", error);
        return alert("No pudimos recuperar los datos de esta propiedad.");
    }

    fotosActualesEdicion = sol.imagenes || [];

    // 2. Verificar si el modal ya existe, si no, crearlo
    let modalContainer = document.getElementById('modal-edicion-cliente');
    if (!modalContainer) {
        modalContainer = document.createElement('div');
        modalContainer.id = 'modal-edicion-cliente';
        document.body.appendChild(modalContainer);
    }

    // 3. Inyectamos el HTML (Aseguramos que los IDs estén presentes)
    modalContainer.innerHTML = `
        <div class="modal fade" id="editPropertyModal" tabindex="-1">
          <div class="modal-dialog modal-lg modal-dialog-centered">
            <div class="modal-content border-0 shadow-lg">
              <div class="modal-header bg-dark text-white">
                <h5 class="modal-title font-serif"><i class="bi bi-pencil-square me-2"></i>Editar: ${sol.titulo}</h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body p-4">
                <div class="row g-3">
                    <div class="col-md-8">
                        <label class="small fw-bold">Título</label>
                        <input type="text" id="edit-titulo" class="form-control" value="${sol.titulo || ''}">
                    </div>
                    <div class="col-md-4">
                        <label class="small fw-bold">Precio (MXN)</label>
                        <input type="number" id="edit-precio" class="form-control" value="${sol.precio || 0}">
                    </div>

                    <div class="col-md-6">
                        <label class="small fw-bold">Tipo de Inmueble</label>
                        <select id="edit-tipo-inmueble" class="form-select">
                            <option value="Casa" ${sol.tipo_inmueble === 'Casa' ? 'selected' : ''}>Casa</option>
                            <option value="Departamento" ${sol.tipo_inmueble === 'Departamento' ? 'selected' : ''}>Departamento</option>
                            <option value="Cuarto" ${sol.tipo_inmueble === 'Cuarto' ? 'selected' : ''}>Cuarto / Habitación</option>
                        </select>
                    </div>
                    <div class="col-md-6">
                        <label class="small fw-bold">Operación</label>
                        <select id="edit-tipo-operacion" class="form-select">
                            <option value="Venta" ${sol.tipo_operacion === 'Venta' ? 'selected' : ''}>Venta</option>
                            <option value="Renta" ${sol.tipo_operacion === 'Renta' ? 'selected' : ''}>Renta</option>
                        </select>
                    </div>

                    <div class="col-md-4">
                        <label class="small fw-bold">Habitaciones</label>
                        <input type="number" id="edit-habitaciones" class="form-control text-center" value="${sol.habitaciones || 0}">
                    </div>
                    <div class="col-md-4">
                        <label class="small fw-bold">Baños</label>
                        <input type="number" id="edit-banos" class="form-control text-center" value="${sol.banos || 0}">
                    </div>
                    <div class="col-md-4">
                        <label class="small fw-bold">Cochera</label>
                        <input type="number" id="edit-estacionamiento" class="form-control text-center" value="${sol.estacionamiento || 0}">
                    </div>

                    <div class="col-12">
                        <label class="small fw-bold">Ubicación</label>
                        <input type="text" id="edit-ubicacion" class="form-control" value="${sol.ubicacion || ''}">
                    </div>
                    <div class="col-12">
                        <label class="small fw-bold">Descripción</label>
                        <textarea id="edit-descripcion" class="form-control" rows="3">${sol.descripcion || ''}</textarea>
                    </div>
                </div>

                <hr class="my-4">
                <label class="small fw-bold mb-2 d-block text-uppercase">Fotos Actuales (Click para eliminar)</label>
                <div id="preview-imagenes-actuales" class="d-flex gap-2 overflow-auto pb-2 border rounded p-2 bg-light"></div>

                <div class="mt-3">
                    <label class="small fw-bold text-primary-custom">Agregar fotos nuevas</label>
                    <input type="file" id="edit-imagenes-nuevas" class="form-control form-control-sm" multiple accept="image/*">
                </div>
              </div>
              <div class="modal-footer bg-light">
                <button type="button" class="btn btn-link text-muted text-decoration-none" data-bs-dismiss="modal">Cancelar</button>
                <button id="btn-save-edit" type="button" class="btn btn-dark-custom px-4" onclick="guardarEdicionPropiedad()">Actualizar Cambios</button>
              </div>
            </div>
          </div>
        </div>`;

    // 4. Renderizar las fotos y mostrar el modal
    renderPreviaFotosEdicion(); 

    const bootstrapLib = window.bootstrap; 
    const editModal = new bootstrapLib.Modal(document.getElementById('editPropertyModal'));
    editModal.show();
}

// --- FUNCIÓN PARA BORRAR FOTOS FÍSICAS DEL STORAGE ---
async function borrarFotosStorage(urls) {
    if (!urls || urls.length === 0) return;
    
    // Las URL públicas son largas, necesitamos extraer solo la ruta interna.
    // Ejemplo: extrae "usuario_id/12345-abc.jpg" de la URL completa
    const rutasArchivos = urls.map(url => {
        return url.split('propiedades-fotos/')[1]; 
    }).filter(ruta => ruta); // Filtramos por si hay algún dato vacío

    if (rutasArchivos.length > 0) {
        // Le mandamos el arreglo de rutas al Storage para que las aniquile
        const { error } = await supabaseClient.storage
            .from('propiedades-fotos')
            .remove(rutasArchivos);
            
        if (error) console.error("Error al limpiar el bucket:", error);
    }
}

// --- 24. FUNCIÓN PARA BLOQUEAR / DESBLOQUEAR USUARIOS ---
async function toggleBloqueoUsuario(userId, nuevoEstado, nombreUsuario) {
    const accion = nuevoEstado === 'bloqueado' ? 'BLOQUEAR' : 'DESBLOQUEAR';
    
    if (!confirm(`¿Estás seguro de que quieres ${accion} a ${nombreUsuario}?`)) return;

    const { error } = await supabaseClient
        .from('perfiles')
        .update({ estado: nuevoEstado })
        .eq('id', userId);

    if (error) {
        alert(`Error al ${accion.toLowerCase()} usuario: ` + error.message);
    } else {
        loadAdminUsuarios(); // Recargamos la tabla para ver los colores cambiar
    }
}

// ==========================================
// --- 25. GENERACIÓN DE REPORTE GENERAL EN PDF ---
// ==========================================
async function descargarReporteGeneral() {
    const btn = document.getElementById('btn-reporte-general');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Armando PDF...`;
    }

    try {
        // 1. Inicializar jsPDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // 2. Título y Encabezado del PDF
        doc.setFontSize(18);
        doc.setTextColor(26, 42, 58); // Azul marino (estilo Innova)
        doc.text("Reporte - Innova", 14, 20);
        
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100); // Gris
        doc.text(`Generado el: ${new Date().toLocaleDateString('es-ES')} a las ${new Date().toLocaleTimeString('es-ES')}`, 14, 28);

        // ----------------------------------------------------
        // SECCIÓN 1: DATOS DE USUARIOS
        // ----------------------------------------------------
        const { data: usuarios, error: errUsu } = await supabaseClient.from('perfiles').select('*');
        if (errUsu) throw errUsu;

        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text("Directorio de Usuarios", 14, 40);

        // Formatear filas de usuarios
        const filasUsuarios = usuarios.map(u => [
            u.id.substring(0, 6) + '...', // Recortamos el ID para que no ocupe toda la tabla
            u.nombre_completo || 'Sin nombre',
            u.correo,
            u.rol.toUpperCase(),
            u.estado || 'activo'
        ]);

        // Dibujar tabla de usuarios
        doc.autoTable({
            startY: 45,
            head: [['ID', 'Nombre Completo', 'Correo', 'Rol', 'Estado']],
            body: filasUsuarios,
            theme: 'grid',
            headStyles: { fillColor: [26, 42, 58] }, // Azul oscuro
            styles: { fontSize: 8, cellPadding: 3 }
        });

        // ----------------------------------------------------
        // SECCIÓN 2: DATOS DE PROPIEDADES
        // ----------------------------------------------------
        // Calculamos dónde terminó la tabla anterior para empezar la nueva abajo
        let finalY = doc.lastAutoTable.finalY + 15; 
        
        // Si ya no hay espacio en la hoja, creamos una página nueva
        if (finalY > 250) {
            doc.addPage();
            finalY = 20;
        }

        const { data: propiedades, error: errProp } = await supabaseClient
            .from('solicitudes_publicacion')
            .select('id, titulo, precio, estatus_revision, perfiles(correo)');
        if (errProp) throw errProp;

        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text("Inventario de Propiedades", 14, finalY);

        // Formatear filas de propiedades
        const filasPropiedades = propiedades.map(p => [
            `#SOL-${p.id}`,
            p.titulo || 'Sin titulo',
            `$${p.precio} MXN`,
            p.estatus_revision,
            p.perfiles ? p.perfiles.correo : 'Desconocido'
        ]);

        // Dibujar tabla de propiedades
        doc.autoTable({
            startY: finalY + 5,
            head: [['ID', 'Título', 'Precio', 'Estatus', 'Dueño']],
            body: filasPropiedades,
            theme: 'grid',
            headStyles: { fillColor: [197, 160, 89] }, // Color dorado para diferenciarla
            styles: { fontSize: 8, cellPadding: 3 }
        });

        // ----------------------------------------------------
        // DESCARGA AUTOMÁTICA
        // ----------------------------------------------------
        const fecha = new Date().toLocaleDateString('es-ES').replace(/\//g, '-');
        doc.save(`Reporte_Innova_${fecha}.pdf`);

    } catch (error) {
        console.error("Error en reporte maestro:", error);
        alert("Hubo un problema al generar el PDF: " + error.message);
    } finally {
        // Regresamos el botón a la normalidad
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="bi bi-file-earmark-pdf-fill me-2"></i> Descargar Reporte General Completo`;
        }
    }
}

function renderPreviaFotosEdicion() {
    const container = document.getElementById('preview-imagenes-actuales');
    if (fotosActualesEdicion.length === 0) {
        container.innerHTML = '<p class="text-muted small italic">No hay fotos en la galería.</p>';
        return;
    }

    container.innerHTML = fotosActualesEdicion.map((url, index) => `
        <div class="position-relative" style="min-width: 120px; height: 90px;">
            <img src="${url}" class="w-100 h-100 object-fit-cover rounded border" onclick="window.open('${url}', '_blank')" style="cursor: zoom-in;" title="Click para ver grande">
            <button onclick="marcarParaBorrar(${index})" class="btn btn-danger btn-sm position-absolute top-0 end-0 m-1 py-0 px-1 shadow-sm" title="Eliminar foto">
                <i class="bi bi-x"></i>
            </button>
        </div>
    `).join('');
}

window.marcarParaBorrar = function(index) {
    const urlBorrada = fotosActualesEdicion.splice(index, 1)[0];
    fotosABorrarStorage.push(urlBorrada); // La mandamos a la "lista negra"
    renderPreviaFotosEdicion(); // Refrescamos la vista
};

// --- FUNCIÓN PARA GUARDAR (CORREGIDA) ---
async function guardarEdicionPropiedad() {
    const btn = document.getElementById('btn-save-edit');
    
    // Capturamos los elementos primero para verificar que existen
    const inputTitulo = document.getElementById('edit-titulo');
    const inputPrecio = document.getElementById('edit-precio');
    const inputUbicacion = document.getElementById('edit-ubicacion');
    const inputDesc = document.getElementById('edit-descripcion');

    // VALIDACIÓN CRÍTICA: Si no encuentra el input, detenemos todo
    if (!inputTitulo || !inputPrecio) {
        alert("Error: No se encontraron los campos del formulario. Intenta recargar la página.");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Guardando...`;

    try {
        let urlsFinales = [...fotosActualesEdicion];
        const fileInput = document.getElementById('edit-imagenes-nuevas');

        if (fileInput && fileInput.files.length > 0) {
            const nuevasUrls = await subirMultiplesFotos(fileInput.files);
            urlsFinales = [...urlsFinales, ...nuevasUrls];
        }

        // 1. Preparamos el objeto con los datos REALES
        const updates = {
            titulo: inputTitulo.value.trim(),
            precio: Number(inputPrecio.value) || 0,
            ubicacion: inputUbicacion.value.trim(),
            descripcion: inputDesc.value.trim(),
            imagenes: urlsFinales,
            // Agregamos los nuevos que pediste
            tipo_inmueble: document.getElementById('edit-tipo-inmueble').value,
            tipo_operacion: document.getElementById('edit-tipo-operacion').value,
            habitaciones: parseInt(document.getElementById('edit-habitaciones').value) || 0,
            banos: parseInt(document.getElementById('edit-banos').value) || 0,
            estacionamiento: parseInt(document.getElementById('edit-estacionamiento').value) || 0,
            estatus_revision: 'Pendiente'
        };

        // Si el título está vacío, algo salió mal al leer el modal
        if (updates.titulo === "") {
            throw new Error("El título no puede estar vacío. Revisa el formulario.");
        }

        // 2. Primero ocultamos del catálogo público
        await supabaseClient.from('inventario_publico').delete().eq('solicitud_id', editSolicitudId);

        // 3. Actualizamos la solicitud principal
        const { error: errUpdate } = await supabaseClient
            .from('solicitudes_publicacion')
            .update(updates)
            .eq('id', editSolicitudId);

        if (errUpdate) throw errUpdate;

        alert("¡Propiedad actualizada correctamente!");
        location.reload();

    } catch (err) {
        console.error("Error al editar:", err);
        alert("No se pudo guardar: " + err.message);
        btn.disabled = false;
        btn.innerHTML = "Actualizar Propiedad";
    }
}

// --- NUEVA FUNCIÓN: Manda a subir varias fotos al mismo tiempo ---
async function subirMultiplesFotos(archivos) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) throw new Error("Debes estar conectado para subir imágenes.");

    // Convertimos la lista de archivos en promesas de subida
    const promesasSubida = Array.from(archivos).map(archivo => 
        subirFotoASupabase(archivo, session.user.id)
    );
    
    // Ejecutamos todas las subidas y regresamos el arreglo de URLs
    return await Promise.all(promesasSubida);
}

async function ejecutarBusqueda() {
    // 1. CAPTURA DE VALORES (Aquí evitamos el error de "not defined")
    const ubicacion = document.getElementById('search-ubicacion').value;
    const tipoInmueble = document.getElementById('search-tipo').value; // El ID debe coincidir en tu HTML
    const operacion = document.getElementById('search-operacion').value; // El ID debe coincidir en tu HTML
    
    const container = document.getElementById('properties-container');
    
    // Feedback visual: Spinner de carga
    container.innerHTML = `
        <div class="text-center py-5 w-100">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="mt-2 text-muted">Filtrando las mejores opciones para ti...</p>
        </div>`;

    try {
        // 2. CONSTRUCCIÓN DE LA CONSULTA
        // Usamos !inner para que los filtros en la tabla relacionada funcionen correctamente
        let query = supabaseClient
            .from('inventario_publico')
            .select(`
                id,
                solicitudes_publicacion!inner (
                    titulo,
                    precio,
                    descripcion,
                    ubicacion,
                    imagenes,
                    tipo_inmueble,
                    tipo_operacion,
                    habitaciones,
                    banos,
                    estacionamiento
                )
            `);

        // 3. APLICACIÓN DE FILTROS DINÁMICOS
        // Solo aplicamos el filtro si el usuario eligió algo distinto a "todos"
        
        if (ubicacion && ubicacion !== 'todos') {
            query = query.eq('solicitudes_publicacion.ubicacion', ubicacion);
        }

        if (tipoInmueble && tipoInmueble !== 'todos') {
            query = query.eq('solicitudes_publicacion.tipo_inmueble', tipoInmueble);
        }

        if (operacion && operacion !== 'todos') {
            query = query.eq('solicitudes_publicacion.tipo_operacion', operacion);
        }

        // 4. EJECUCIÓN
        const { data: resultados, error } = await query;

        if (error) throw error;

        // 5. RENDERIZADO DE RESULTADOS
        renderizarResultados(resultados);

    } catch (err) {
        console.error("❌ ERROR EN BÚSQUEDA:", err);
        container.innerHTML = `
            <div class="alert alert-danger mx-auto mt-4 text-center" style="max-width: 600px;">
                <i class="bi bi-exclamation-triangle-fill fs-4 d-block mb-2"></i>
                <strong>Error en la consulta:</strong> ${err.message}<br>
                <small class="text-dark">Asegúrate de que las columnas coincidan en Supabase.</small>
            </div>`;
    }
}

// --- FUNCIÓN PARA MOSTRAR LOS RESULTADOS FILTRADOS (DISEÑO PREMIUM COMPLETO) ---
function renderizarResultados(lista) {
    const container = document.getElementById('properties-container');
    
    if (!lista || lista.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5 w-100">
                <i class="bi bi-house-exclamation display-1 text-muted"></i>
                <h3 class="mt-3">No encontramos lo que buscas</h3>
                <p class="text-muted">Prueba con otra ubicación o filtros diferentes.</p>
                <button onclick="renderProperties()" class="btn btn-outline-dark btn-sm">Ver todo el catálogo</button>
            </div>`;
        return;
    }

    container.innerHTML = lista.map(item => {
        const prop = item.solicitudes_publicacion;
        
        // CORRECCIÓN 1: Usar 'imagenes' (nombre real en tu DB) en lugar de 'images'
        const fotos = prop.imagenes || [];
        const portada = fotos.length > 0 ? fotos[0] : "https://via.placeholder.com/800x600?text=Sin+Imagen";

        // CORRECCIÓN 2: Lógica del Badge Venta/Renta (Faltaba en el buscador)
        const tipo = prop.tipo_operacion || 'Venta'; 
        const badgeBg = tipo.toLowerCase() === 'renta' ? '#198754' : '#0d6efd'; 
        const badgeHTML = `<span class="badge rounded-pill px-3 py-1 shadow-sm" 
                                 style="background-color: ${badgeBg}; font-family: sans-serif; font-size: 0.75rem; letter-spacing: 0.5px;">
                                 ${tipo}
                           </span>`;

        // CORRECCIÓN 3: Badge de Disponibilidad
        const estatus = prop.estatus_revision;
        const badgeDisponibilidad = (estatus === 'Vendida')
            ? `<span class="position-absolute top-0 start-0 m-3 badge bg-danger text-white px-3 py-2 rounded-pill shadow-sm backdrop-blur" style="backdrop-filter: blur(4px);">
                   <i class="bi bi-tag-fill me-1"></i> Vendida
               </span>`
            : `<span class="position-absolute top-0 start-0 m-3 badge bg-dark bg-opacity-75 text-white px-3 py-2 rounded-pill shadow-sm backdrop-blur" style="backdrop-filter: blur(4px);">
                   <i class="bi bi-check-circle me-1"></i> Disponible
               </span>`;

        return `
            <div class="col-md-4 mb-4">
                <div class="property-card h-100 shadow-sm bg-white pb-3 rounded-4 border-0" 
                     style="transition: all 0.3s ease; cursor: pointer;"
                     onmouseover="this.classList.replace('shadow-sm', 'shadow-lg'); this.style.transform='translateY(-8px)';"
                     onmouseout="this.classList.replace('shadow-lg', 'shadow-sm'); this.style.transform='translateY(0)';"
                     onclick="window.location.href='detalle.html?id=${item.id}'">
                    
                    <div class="position-relative overflow-hidden rounded-top-4" style="height:240px;">
                        <img src="${portada}" class="img-fluid w-100 h-100 object-fit-cover">
                        ${badgeDisponibilidad}
                    </div>
                    
                    <div class="px-4 pt-4 pb-2">
                        <div class="mb-3 d-flex flex-column" style="min-height: 5em;"> 
                            <div class="fw-bold fs-4" style="color: #1a202c;">$${Number(prop.precio).toLocaleString('es-MX')} <small class="fs-6 text-muted">MXN</small></div>
                            <div class="text-muted small mt-1 d-flex align-items-center">
                                <i class="bi bi-geo-alt-fill text-danger me-1"></i>${prop.ubicacion || 'Ubicación a consultar'}
                            </div>
                        </div>
                        
                        <div class="d-flex justify-content-between align-items-start gap-2 mb-3">
                            <h5 class="font-serif fw-bold text-dark mb-0 text-truncate" style="font-size: 1.15rem; max-width: 75%;">
                                ${prop.titulo}
                            </h5>
                            <div>${badgeHTML}</div>
                        </div>
                        
                        <div class="d-flex gap-4 text-muted mt-2 mb-3" style="font-size: 0.9rem;"> 
                            <span title="Habitaciones"><i class="bi bi-door-open fs-5 me-1"></i> ${prop.habitaciones || '-'}</span>
                            <span title="Baños"><i class="bi bi-droplet fs-5 me-1"></i> ${prop.banos || '-'}</span>
                            <span title="Cochera"><i class="bi bi-car-front fs-5 me-1"></i> ${prop.estacionamiento || '-'}</span>
                        </div>
                        
                        <hr class="text-muted opacity-25 my-3">
                        
                        <a href="detalle.html?id=${item.id}" class="btn btn-dark w-100 py-2 fw-bold rounded-3">
                            Ver Detalles <i class="bi bi-arrow-right ms-1"></i>
                        </a>
                    </div>
                </div>
            </div>`;
    }).join('');
}

// --- FUNCIÓN: LLENAR EL SELECT CON UBICACIONES REALES ---
async function cargarUbicacionesDinamicas() {
    const selectUbicacion = document.getElementById('search-ubicacion');
    if (!selectUbicacion) return;

    // 1. Traemos solo la columna 'ubicacion' de las casas aprobadas
    const { data, error } = await supabaseClient
        .from('solicitudes_publicacion')
        .select('ubicacion')
        .eq('estatus_revision', 'Aprobada');

    if (error) {
        console.error("Error al traer ubicaciones:", error);
        return;
    }

    // 2. Quitamos duplicados (para que no salga "Cholula" 5 veces)
    // El filter(u => u) quita valores nulos o vacíos
    const listaLimpia = [...new Set(data.map(item => item.ubicacion).filter(u => u))];

    // 3. Limpiamos el select y dejamos la opción por defecto
    selectUbicacion.innerHTML = '<option value="todos">Todas las zonas</option>';

    // 4. Agregamos las que encontramos en la DB
    listaLimpia.forEach(lugar => {
        const option = document.createElement('option');
        option.value = lugar;
        option.textContent = lugar;
        selectUbicacion.appendChild(option);
    });
}

// --- 6. PERFIL DE USUARIO (ACTUALIZADO Y CORREGIDO) ---
async function loadUserProfile() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return window.location.href = 'login.html';

    const { data: perfil, error } = await supabaseClient
        .from('perfiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

    if (error) {
        console.error("Error al obtener perfil:", error);
        return;
    }

    if (perfil) {
        // 1. Llenar campos de texto (Vista)
        if (document.getElementById('display-name')) {
            document.getElementById('display-name').innerText = perfil.nombre_completo;
        }
        if (document.getElementById('display-email')) {
            document.getElementById('display-email').innerText = perfil.correo;
        }
        if (document.getElementById('display-tel')) {
            document.getElementById('display-tel').innerText = perfil.telefono || 'Sin número';
        }

        // 2. Llenar inputs del formulario (Edición)
        if (document.getElementById('perfil-nombre')) {
            document.getElementById('perfil-nombre').value = perfil.nombre_completo;
        }
        if (document.getElementById('perfil-tel')) {
            document.getElementById('perfil-tel').value = perfil.telefono || '';
        }
        if (document.getElementById('perfil-bio')) {
            document.getElementById('perfil-bio').value = perfil.biografia || '';
        }

        // 3. Lógica del Avatar (Foto vs Iniciales)
        const avatarImg = document.getElementById('profile-avatar');
        if (avatarImg) {
            const container = avatarImg.parentElement;
            
            // Limpiamos cualquier placeholder previo para que no se dupliquen
            const oldPlaceholder = document.getElementById('initials-avatar');
            if (oldPlaceholder) oldPlaceholder.remove();

            if (perfil.avatar_url && perfil.avatar_url !== "") {
                // Si hay foto, la mostramos y ocultamos el placeholder
                avatarImg.src = perfil.avatar_url;
                avatarImg.classList.remove('d-none');
            } else {
                // Si NO hay foto, ocultamos la imagen y creamos el círculo con iniciales
                avatarImg.classList.add('d-none');
                
                const inicial = perfil.nombre_completo ? perfil.nombre_completo.charAt(0).toUpperCase() : '?';
                
                const placeholder = document.createElement('div');
                placeholder.id = 'initials-avatar';
                placeholder.className = 'avatar-placeholder'; // Asegúrate de tener este CSS
                placeholder.innerText = inicial;
                
                // Insertamos el placeholder justo donde estaba la imagen
                container.insertBefore(placeholder, avatarImg);
            }
        }
    }
    
    // Cargamos las propiedades del usuario
    loadMyPublishedProperties(session.user.id);
}

// --- DENTRO DE updateProfile ---
async function updateProfile(event) {
    event.preventDefault();
    const nuevoNombre = document.getElementById('perfil-nombre').value;
    const nuevoTel = document.getElementById('perfil-tel').value; // Capturamos el cambio
    
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    const updates = {
        id: session.user.id, // <-- CRÍTICO: Esto asegura que solo te editas a ti mismo
        nombre_completo: nuevoNombre,
        telefono: nuevoTel, // Guardamos el nuevo número
        biografia: document.getElementById('perfil-bio').value,
    };

    const { error } = await supabaseClient.from('perfiles').upsert(updates);

    if (error) {
        alert("Error al actualizar: " + error.message);
    } else {
        // Actualizamos visualmente la interfaz sin recargar
        if (document.getElementById('username-display')) {
            document.getElementById('username-display').innerText = nuevoNombre;
        }
        if (document.getElementById('display-tel')) {
            document.getElementById('display-tel').innerText = nuevoTel;
        }
        alert("¡Perfil actualizado correctamente!");
    }
}

// --- SUBIR FOTO DE PERFIL ---
async function subirAvatar() {
    const file = document.getElementById('upload-avatar').files[0];
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${session.user.id}-${Math.random()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    const { error: uploadError } = await supabaseClient.storage
        .from('propiedades-fotos')
        .upload(filePath, file);

    if (uploadError) return alert("Error al subir foto");

    const { data: { publicUrl } } = supabaseClient.storage.from('propiedades-fotos').getPublicUrl(filePath);
    
    await supabaseClient.from('perfiles').update({ avatar_url: publicUrl }).eq('id', session.user.id);
    document.getElementById('profile-avatar').src = publicUrl;
}

async function loadMyPublishedProperties(userId) {
    const container = document.getElementById('mis-propiedades-container') || 
                      document.getElementById('vend-propiedades-container');
    
    if (!container) return;

    try {
        // 1. OBTENER SESIÓN DEL QUE ESTÁ MIRANDO (EL VISITANTE)
        const { data: { session } } = await supabaseClient.auth.getSession();
        const visitorId = session?.user?.id;

        // 2. VERIFICAR ROL (Para saber si el visitante es Admin)
        let isAdmin = false;
        if (session) {
            const { data: perfil } = await supabaseClient
                .from('perfiles')
                .select('rol')
                .eq('id', visitorId)
                .single();
            isAdmin = perfil?.rol === 'admin';
        }

        // 3. ¿EL VISITANTE ES EL DUEÑO O UN ADMIN?
        const isOwnerOrAdmin = (visitorId === userId) || isAdmin;

        // 4. ARMAR LA CONSULTA CON FILTRO
        let query = supabaseClient
            .from('solicitudes_publicacion')
            .select(`
                id, titulo, precio, imagenes, estatus_revision, tipo_operacion,
                inventario_publico(id)
            `)
            .eq('propietario_id', userId)
            .order('id', { ascending: false });

        // --- EL FILTRO DE PRIVACIDAD ---
        // Si NO es el dueño ni admin, SOLO mostrar las Aprobadas
        if (!isOwnerOrAdmin) {
            query = query.eq('estatus_revision', 'Aprobada');
        }

        const { data: propiedades, error } = await query;
        if (error) throw error;

        // 5. RENDERIZAR (Si no hay nada tras el filtro, poner mensaje vacío)
        if (!propiedades || propiedades.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5 w-100 opacity-50">
                    <i class="bi bi-house-slash display-4"></i>
                    <p class="mt-2">No hay propiedades públicas disponibles.</p>
                </div>`;
            return;
        }

        container.innerHTML = propiedades.map(prop => {
            const portada = (prop.imagenes && prop.imagenes.length > 0) ? prop.imagenes[0] : 'https://via.placeholder.com/400x250';
            
            // Badges solo visibles para el dueño/admin si no están aprobadas
            let statusBadge = '';
            if (isOwnerOrAdmin) {
                if (prop.estatus_revision === 'Aprobada') statusBadge = `<span class="badge bg-success position-absolute top-0 end-0 m-2 shadow-sm">Pública</span>`;
                if (prop.estatus_revision === 'Pendiente') statusBadge = `<span class="badge bg-warning text-dark position-absolute top-0 end-0 m-2 shadow-sm">En Revisión</span>`;
                if (prop.estatus_revision === 'Rechazada') statusBadge = `<span class="badge bg-danger position-absolute top-0 end-0 m-2 shadow-sm">Rechazada</span>`;
            }

            const invId = prop.inventario_publico?.[0]?.id;
            const urlDestino = invId ? `detalle.html?id=${invId}` : `borrador.html?id=${prop.id}`;

            return `
                <div class="col-md-6 mb-3">
                    <div class="card border-0 shadow-sm h-100 overflow-hidden rounded-4">
                        <div class="position-relative" style="height: 160px;">
                            <img src="${portada}" class="w-100 h-100 object-fit-cover">
                            ${statusBadge}
                        </div>
                        <div class="p-3">
                            <h6 class="text-truncate fw-bold mb-1">${prop.titulo}</h6>
                            <p class="text-primary-custom small fw-bold mb-3">$${prop.precio} MXN</p>
                            <a href="${urlDestino}" class="btn btn-dark-custom btn-sm w-100 fw-bold">
                                <i class="bi bi-eye me-1"></i> Ver Detalles
                            </a>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("Error en vitrina privada:", err);
    }
}


// --- CARGAR PERFIL PÚBLICO DEL VENDEDOR (vendedor.html) ---
async function loadPublicProfile(vendedorId) {
    // 1. Traer datos del vendedor
    const { data: perfil, error } = await supabaseClient
        .from('perfiles')
        .select('nombre_completo, correo, telefono, biografia, avatar_url')
        .eq('id', vendedorId)
        .single();

    if (error) return alert("Vendedor no encontrado");

    // 2. Llenar la interfaz de texto
    document.getElementById('vend-nombre').innerText = perfil.nombre_completo;
    document.getElementById('vend-email').innerHTML = `<i class="bi bi-envelope me-2"></i>${perfil.correo}`;
    document.getElementById('vend-tel').innerHTML = `<i class="bi bi-telephone me-2"></i>${perfil.telefono || 'No disponible'}`;
    document.getElementById('vend-bio').innerText = perfil.biografia || 'Este vendedor aún no ha escrito su biografía.';

    // 3. Lógica del Avatar (Foto Real vs Iniciales)
    const avatarImg = document.getElementById('vend-avatar');
    if (avatarImg) {
        const container = avatarImg.parentElement; // El .vend-avatar-container
        
        // Limpiamos cualquier inicial previa por si acaso
        const oldPlaceholder = document.getElementById('vend-initials-avatar');
        if (oldPlaceholder) oldPlaceholder.remove();

        if (perfil.avatar_url && perfil.avatar_url !== "") {
            // Si tiene foto, la mostramos y ocultamos el placeholder
            avatarImg.src = perfil.avatar_url;
            avatarImg.classList.remove('d-none');
        } else {
            // Si NO tiene foto, ocultamos el img y creamos el círculo con iniciales
            avatarImg.classList.add('d-none');
            
            const inicial = perfil.nombre_completo ? perfil.nombre_completo.charAt(0).toUpperCase() : '?';
            
            const placeholder = document.createElement('div');
            placeholder.id = 'vend-initials-avatar';
            placeholder.className = 'avatar-placeholder'; // Usamos la clase CSS nueva
            placeholder.innerText = inicial;
            
            // Insertamos el placeholder
            container.insertBefore(placeholder, avatarImg);
        }
    }

    // 4. Configurar botón de WhatsApp
    if(perfil.telefono) {
        // Limpiamos el número de espacios o guiones antes de armar el link
        const numeroLimpio = perfil.telefono.replace(/\D/g, '');
        document.getElementById('btn-whatsapp').href = `https://wa.me/${numeroLimpio}`;
        document.getElementById('btn-whatsapp').classList.remove('d-none');
    } else {
        document.getElementById('btn-whatsapp').classList.add('d-none');
    }

    // 5. Traer sus propiedades aprobadas
    loadMyPublishedProperties(vendedorId);
}
// --- FUNCIÓN PARA GENERAR LA RÚBRICA DE EVALUACIÓN ---
async function descargarRubricaInnova() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); // 'l' para que sea horizontal y quepa la tabla

    // Encabezado con estilo
    doc.setFontSize(22);
    doc.setTextColor(26, 42, 58); // Tu azul marino de Innova
    doc.text("INNOVA - Estándar de Calidad de Propiedades", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("Guía oficial para la aprobación de publicaciones en el catálogo público.", 14, 28);

    // Definición de la Rúbrica basada en el estándar
    const columnas = ["Criterio", "Aprobado (3 pts)", "Observación (1 pt)", "Rechazado (0 pts)"];
    const filas = [
        ["Calidad de Imagen", "Mínimo 5 fotos nítidas, con buena luz y que muestren fachada e interiores.", "Menos de 3 fotos o imágenes con baja resolución/oscuras.", "Fotos de internet, memes, capturas de pantalla o marcas de agua ajenas."],
        ["Coherencia de Precio", "Precio acorde al mercado y zona. Cifras completas (ej: $2,500,000).", "Precio sospechosamente bajo o alto sin justificación en descripción.", "Precios de $0, $1, o textos como 'A tratar' en el campo numérico."],
        ["Info. Técnica", "Habitaciones, baños y cochera coinciden con lo que se ve en las fotos.", "Datos incompletos (ej: falta el número de baños).", "Información claramente falsa o exagerada (ej: 20 habitaciones en un depa)."],
        ["Ubicación", "Zona específica y real (ej: Angelópolis, Cholula).", "Ubicación muy general (ej: 'Puebla, Puebla').", "Dirección inexistente o fuera de la zona de cobertura de INNOVA."],
        ["Descripción", "Texto profesional, sin faltas de ortografía, detallando beneficios de la casa.", "Texto muy corto (menos de 20 palabras) o con mayúsculas excesivas.", "Contiene groserías, spam, enlaces externos prohibidos o info. de contacto en el texto."],
        ["Perfil del Dueño", "Cuenta con nombre real, teléfono de contacto y foto de perfil clara.", "Perfil sin biografía o con nombre incompleto.", "Perfil anónimo, datos de contacto falsos o cuenta bloqueada."]
    ];

    // Generar la tabla
    doc.autoTable({
        startY: 35,
        head: [columnas],
        body: filas,
        theme: 'grid',
        headStyles: { fillColor: [26, 42, 58], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 4, valign: 'middle' },
        columnStyles: {
            0: { fontStyle: 'bold', fillColor: [245, 245, 245], cellWidth: 35 },
            1: { cellWidth: 70 },
            2: { cellWidth: 70 },
            3: { cellWidth: 70 }
        }
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.setTextColor(26, 42, 58);
    doc.text("Puntuación mínima para aprobación: 14 puntos.", 14, finalY);

    doc.save("Rubrica_Evaluacion_INNOVA.pdf");
}

let evaluacionActual = {
    solicitudId: null,
    puntos: { imagen: 0, precio: 0, tecnica: 0, ubicacion: 0, descripcion: 0, perfil: 0 }
};

const criteriosRubrica = [
    { 
        key: 'imagen', 
        label: 'Calidad de Imagen',
        desc0: 'Fotos de internet, memes, capturas de pantalla o marcas de agua ajenas.',
        desc1: 'Menos de 3 fotos o imágenes con baja resolución/oscuras.',
        desc3: 'Mínimo 5 fotos nítidas, con buena luz y que muestren fachada e interiores.'
    },
    { 
        key: 'precio', 
        label: 'Coherencia de Precio',
        desc0: "Precios de $0, $1, o textos como 'A tratar' en el campo numérico.",
        desc1: 'Precio sospechosamente bajo o alto sin justificación en descripción.',
        desc3: 'Precio acorde al mercado y zona. Cifras completas (ej: $2,500,000).'
    },
    { 
        key: 'tecnica', 
        label: 'Info. Técnica',
        desc0: 'Información claramente falsa o exagerada (ej: 20 habitaciones en un depa).',
        desc1: 'Datos incompletos (ej: falta el número de baños).',
        desc3: 'Habitaciones, baños y cochera coinciden con lo que se ve en las fotos.'
    },
    { 
        key: 'ubicacion', 
        label: 'Ubicación',
        desc0: 'Dirección inexistente o fuera de la zona de cobertura de INNOVA.',
        desc1: "Ubicación muy general (ej: 'Puebla, Puebla').",
        desc3: 'Zona específica y real (ej: Angelópolis, Cholula).'
    },
    { 
        key: 'descripcion', 
        label: 'Descripción',
        desc0: 'Contiene groserías, spam, enlaces externos prohibidos o info. de contacto.',
        desc1: 'Texto muy corto (menos de 20 palabras) o con mayúsculas excesivas.',
        desc3: 'Texto profesional, sin faltas de ortografía, detallando beneficios.'
    },
    { 
        key: 'perfil', 
        label: 'Perfil del Dueño',
        desc0: 'Perfil anónimo, datos de contacto falsos o cuenta bloqueada.',
        desc1: 'Perfil sin biografía o con nombre incompleto.',
        desc3: 'Cuenta con nombre real, teléfono de contacto y foto de perfil clara.'
    }
];

async function abrirEvaluadorInteractivo(id, titulo) {
    evaluacionActual.solicitudId = id;
    evaluacionActual.puntos = { imagen: 0, precio: 0, tecnica: 0, ubicacion: 0, descripcion: 0, perfil: 0 };
    
    const infoCont = document.getElementById('info-propiedad-evaluar');
    const tablaCont = document.getElementById('tabla-puntos');

    if (!infoCont || !tablaCont) return;

    infoCont.innerHTML = `<div class="d-flex justify-content-between">
        <span><strong>Evaluando:</strong> ${titulo}</span>
        <span class="badge bg-secondary">Mínimo para aprobar: 14 pts</span>
    </div>`;
    
    // Generar filas con descripciones completas
    tablaCont.innerHTML = criteriosRubrica.map(c => `
        <tr class="border-bottom">
            <td style="width: 25%;">
                <div class="fw-bold text-dark">${c.label}</div>
                <div class="text-center mt-2">
                    <span class="badge rounded-pill bg-light text-dark border" id="badge-${c.key}" style="font-size: 1.1rem;">0 pts</span>
                </div>
            </td>
            <td style="width: 75%;">
                <div class="row g-2">
                    <div class="col-4">
                        <button class="btn btn-outline-danger w-100 btn-sm mb-1" onclick="sumarPunto('${c.key}', 0)">0 Pts</button>
                        <div class="small text-muted p-1" style="font-size: 0.7rem; line-height: 1;">${c.desc0}</div>
                    </div>
                    <div class="col-4">
                        <button class="btn btn-outline-warning w-100 btn-sm mb-1" onclick="sumarPunto('${c.key}', 1)">1 Pt</button>
                        <div class="small text-muted p-1" style="font-size: 0.7rem; line-height: 1;">${c.desc1}</div>
                    </div>
                    <div class="col-4">
                        <button class="btn btn-outline-success w-100 btn-sm mb-1" onclick="sumarPunto('${c.key}', 3)">3 Pts</button>
                        <div class="small text-muted p-1" style="font-size: 0.7rem; line-height: 1;">${c.desc3}</div>
                    </div>
                </div>
            </td>
        </tr>
    `).join('');

    actualizarTotal();
    const modal = new bootstrap.Modal(document.getElementById('modalEvaluador'));
    modal.show();
}

function sumarPunto(key, valor) {
    evaluacionActual.puntos[key] = valor;
    document.getElementById(`badge-${key}`).innerText = valor;
    
    // Cambiar color del badge según el puntaje
    const badge = document.getElementById(`badge-${key}`);
    badge.className = `badge fs-6 ${valor === 3 ? 'bg-success' : valor === 1 ? 'bg-warning text-dark' : 'bg-danger'}`;
    
    actualizarTotal();
}

function actualizarTotal() {
    const display = document.getElementById('total-puntos');
    const recomendacion = document.getElementById('status-recomendacion');
    const btnAprobar = document.getElementById('btn-finalizar-aprobacion');
    const btnRechazar = document.getElementById('btn-finalizar-rechazo');

    // --- EL ESCUDO PROTECTOR ---
    // Si no encuentra el display, significa que no estamos en el panel de admin.
    // Con este 'if' evitamos que el código truene y mande el error de 'null'.
    if (!display || !recomendacion || !btnAprobar) return;

    // 1. Calculamos la suma de los puntos
    const total = Object.values(evaluacionActual.puntos).reduce((a, b) => a + b, 0);

    // 2. Mostramos el total
    display.innerText = total;

    // 3. Lógica de colores y validación del estándar
    if (total >= 14) {
        display.className = "text-success fw-bold fs-4";
        recomendacion.innerText = "✓ CUMPLE CON EL ESTÁNDAR";
        recomendacion.className = "text-success fw-bold small text-uppercase";
        btnAprobar.disabled = false;
    } else {
        display.className = "text-danger fw-bold fs-4";
        recomendacion.innerText = "⚠ NO CUMPLE EL MÍNIMO (14 pts)";
        recomendacion.className = "text-danger fw-bold small text-uppercase";
        btnAprobar.disabled = true;
    }

    // 4. Configurar los botones de acción final con protección
    btnAprobar.onclick = () => aprobarSolicitud(evaluacionActual.solicitudId);
    
    if (btnRechazar) {
        btnRechazar.onclick = () => rechazarSolicitud(evaluacionActual.solicitudId);
    }
}

// Agregamos una variable para el texto del reporte
let reporteComentarios = "";

function generarComentariosReporte() {
    let comentarios = "Reporte de Evaluación INNOVA:\n";
    let fallos = [];

    criteriosRubrica.forEach(c => {
        const pts = evaluacionActual.puntos[c.key];
        if (pts === 0) {
            fallos.push(`- ${c.label}: RECHAZADO. ${c.desc0}`);
        } else if (pts === 1) {
            fallos.push(`- ${c.label}: OBSERVACIÓN. ${c.desc1}`);
        }
    });

    if (fallos.length > 0) {
        reporteComentarios = comentarios + fallos.join("\n");
    } else {
        reporteComentarios = "La propiedad cumple con los puntos, pero requiere revisión manual por el admin.";
    }
}

// --- NUEVA LÓGICA: ABRIR MODAL PARA OFERTA ---
function hacerOferta(citaId, nombreCasa) {
    // Llenamos el modal con los datos
    document.getElementById('oferta-cita-id').value = citaId;
    document.getElementById('oferta-nombre-casa').innerText = nombreCasa;
    document.getElementById('oferta-mensaje').value = ''; // Limpiar el área de texto
    
    // Mostramos el modal de Bootstrap
    const modal = new bootstrap.Modal(document.getElementById('modalOferta'));
    modal.show();
}

// --- NUEVA LÓGICA: GUARDAR OFERTA EN SUPABASE ---
async function enviarOfertaBD() {
    const citaId = document.getElementById('oferta-cita-id').value;
    const mensaje = document.getElementById('oferta-mensaje').value.trim();

    if (!mensaje) {
        alert("Por favor, escribe una oferta o mensaje antes de enviar.");
        return;
    }

    // Actualizamos el estatus Y guardamos el texto en la nueva columna 'mensaje_oferta'
    const { error } = await supabaseClient
        .from('citas_cliente')
        .update({ 
            estatus_cita: 'Oferta Recibida',
            mensaje_oferta: mensaje 
        })
        .eq('id', citaId);

    if (error) {
        alert("Hubo un error al enviar tu oferta.");
        console.error(error);
    } else {
        alert("¡Tu oferta ha sido enviada con éxito al asesor!");
        
        // Esconder el modal correctamente
        const modalEl = document.getElementById('modalOferta');
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if(modalInstance) modalInstance.hide();
        
        loadClienteDashboard(); // Recargar la vista
    }
}

// --- NUEVA LÓGICA: EL ADMIN CIERRA EL TRATO ---
async function cerrarTrato(citaId) {
    const confirmar = confirm("¿Estás seguro de que deseas aceptar la oferta y marcar esta propiedad como TRATO CERRADO?");
    if (!confirmar) return;

    const { error } = await supabaseClient
        .from('citas_cliente')
        .update({ estatus_cita: 'Trato Cerrado' })
        .eq('id', citaId);

    if (error) {
        alert("Error al cerrar el trato.");
    } else {
        alert("¡Felicidades! Has cerrado el trato con el cliente.");
        // Opcional: Aquí podrías también hacer un update a 'inventario_publico' para quitar la propiedad de circulación.
        loadAdminDashboard();
    }
}

// --- LÓGICA DEL ADMIN: ABRIR EL MODAL DE LA OFERTA ---
function abrirModalOfertaAdmin(citaId, cliente, casa, mensaje) {
    document.getElementById('admin-oferta-cita-id').value = citaId;
    document.getElementById('admin-oferta-cliente').innerText = cliente;
    document.getElementById('admin-oferta-casa').innerText = casa;
    document.getElementById('admin-oferta-mensaje').innerText = mensaje;
    document.getElementById('admin-oferta-respuesta').value = ''; // Limpiamos el área de texto

    const modal = new bootstrap.Modal(document.getElementById('modalOfertaAdmin'));
    modal.show();
}

// --- 18. FUNCIÓN PARA QUE EL PROPIETARIO PROCESE OFERTAS (P2P) ---
window.procesarOferta = async function(accion) {
    // 1. Capturamos los datos del modal (usamos los IDs que ya tienes en el HTML)
    const citaActualId = document.getElementById('admin-oferta-cita-id').value;
    const mensajeInput = document.getElementById('admin-oferta-respuesta');
    const mensajePropietario = mensajeInput.value.trim();

    if (!citaActualId) return alert("Error: No se detectó la cita.");

    // Validación: Para contraofertas el mensaje es obligatorio
    if (accion === 'contraoferta' && mensajePropietario === '') {
        alert("Escribe una contraoferta para el interesado (ej: Acepto $X cantidad).");
        mensajeInput.focus();
        return; 
    }

    // 2. Definimos el nuevo estado según la acción
    let nuevoEstado = '';
    if (accion === 'aceptar') {
        nuevoEstado = 'Trato Cerrado';
    } else if (accion === 'rechazar') {
        nuevoEstado = 'Oferta Rechazada';
    } else if (accion === 'contraoferta') {
        nuevoEstado = 'Contraoferta Recibida';
    }

    const confirmar = confirm(`¿Estás seguro de querer ${accion} esta oferta?`);
    if (!confirmar) return;

    try {
        // 3. Actualizamos la cita en Supabase
        const { error } = await supabaseClient
            .from('citas_cliente')
            .update({ 
                estatus_cita: nuevoEstado, 
                respuesta_admin: mensajePropietario // Guardamos tu respuesta para el comprador
            })
            .eq('id', citaActualId);

        if (error) throw error;

        // --- 4. LA MAGIA: SI EL DUEÑO ACEPTA, LA CASA SE MARCA COMO VENDIDA ---
        if (accion === 'aceptar') {
            const { data: citaData } = await supabaseClient
                .from('citas_cliente')
                .select('propiedad_id')
                .eq('id', citaActualId)
                .single();

            if (citaData?.propiedad_id) {
                await supabaseClient
                    .from('solicitudes_publicacion')
                    .update({ estatus_revision: 'Vendida' }) 
                    .eq('id', citaData.propiedad_id);
            }
        }

        // 5. Éxito y Limpieza
        alert(`Oferta procesada: ${nuevoEstado}`);
        
        mensajeInput.value = '';
        const modalElement = document.getElementById('modalOfertaAdmin');
        const modalInstance = bootstrap.Modal.getInstance(modalElement);
        if (modalInstance) modalInstance.hide();

        loadClienteDashboard(); // Refrescamos tu panel de dueño

    } catch (err) {
        console.error("Error al procesar oferta:", err);
        alert("Hubo un error al guardar la decisión.");
    }
};

function eliminarCitaAdmin(citaId) {
    citaIdPendienteEliminar = citaId;
    
    if (!document.getElementById('modalMenuEliminar')) {
        const modalHTML = `
            <div class="modal fade" id="modalMenuEliminar" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content shadow-lg border-0">
                        <div class="modal-header border-0 pb-0">
                            <h5 class="modal-title w-100 text-center fw-bold fs-4 text-dark">¿La casa se vendió?</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body text-center pt-2 pb-4 px-4">
                            <p class="text-muted mb-4">Selecciona una opción para finalizar este registro de cita.</p>
                            
                            <button class="btn btn-success w-100 mb-3 py-3 fw-bold fs-5 shadow-sm" onclick="ejecutarEliminacion('vendida')">
                                SÍ, LA CASA FUE VENDIDA
                            </button>
                            
                            <button class="btn btn-danger w-100 py-3 fw-bold fs-5 shadow-sm" onclick="ejecutarEliminacion('caida')">
                                No, no se cerró el trato
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    const modalOpciones = new bootstrap.Modal(document.getElementById('modalMenuEliminar'));
    modalOpciones.show();
}

async function ejecutarEliminacion(opcion) {
    const modalEl = document.getElementById('modalMenuEliminar');
    const modalInstancia = bootstrap.Modal.getInstance(modalEl);
    if (modalInstancia) modalInstancia.hide();

    const citaId = citaIdPendienteEliminar;
    if (!citaId) return;

    try {
        // 1. Primero obtenemos la información de la cita para saber qué casa es
        const { data: citaData } = await supabaseClient
            .from('citas_cliente')
            .select('*')
            .eq('id', citaId)
            .single();

        const idDeLaCasa = citaData?.solicitud_id || citaData?.propiedad_id || citaData?.solicitudes_publicacion_id;

        if (opcion === 'vendida') {
            if (idDeLaCasa) {
                // Marcamos como Vendida definitivamente
                await supabaseClient
                    .from('solicitudes_publicacion')
                    .update({ estatus_revision: 'Vendida' })
                    .eq('id', idDeLaCasa);
                alert("¡Felicidades por la venta! Registro finalizado.");
            }
        } else if (opcion === 'caida') {
            if (idDeLaCasa) {
                // --- CORRECCIÓN AQUÍ ---
                // Si el trato se cayó, regresamos la casa a 'Aprobada' para que vuelva a estar 'Disponible'
                await supabaseClient
                    .from('solicitudes_publicacion')
                    .update({ estatus_revision: 'Aprobada' })
                    .eq('id', idDeLaCasa);
                alert("El trato no se cerró. La casa vuelve a estar disponible en el catálogo.");
            }
        }

        // 2. En cualquiera de los dos casos, borramos la cita para limpiar tu panel
        await supabaseClient.from('citas_cliente').delete().eq('id', citaId);

        // 3. Recargamos tu panel para que veas los cambios
        loadClienteDashboard(); 

    } catch (error) {
        console.error("Error en la eliminación:", error);
        alert("Hubo un error al conectar con la base de datos.");
    }
}

async function procesarOferta(accion) {
    // 1. Obtener el ID de la cita y el mensaje del HTML
    const citaActualId = document.getElementById('admin-oferta-cita-id').value;
    const mensajeInput = document.getElementById('admin-oferta-respuesta');
    const mensajeAdmin = mensajeInput.value.trim();

    // Validación de seguridad: Evitar enviar a Supabase si el ID está vacío
    if (!citaActualId) {
        alert("Error de conexión: No se detectó la cita exacta. Por favor, cierra este cuadro y vuelve a darle a 'Ver Oferta'.");
        return;
    }

    // 2. VALIDACIÓN ESTRELLA: Si es contraoferta, el mensaje es 100% obligatorio
    if (accion === 'contraoferta' && mensajeAdmin === '') {
        alert("¡Ojo! Para enviar una contraoferta es obligatorio escribirle una respuesta al cliente.");
        mensajeInput.focus(); // Ponemos el cursor parpadeando en la caja de texto
        return; 
    }

    // 3. Definir qué estado se le va a guardar al cliente según el botón presionado
    let nuevoEstado = '';
    if (accion === 'aceptar') {
        nuevoEstado = 'Trato Cerrado'; // <-- Cambiado para que cierre el trato directo
    } else if (accion === 'rechazar') {
        nuevoEstado = 'Oferta Rechazada';
    } else if (accion === 'contraoferta') {
        nuevoEstado = 'Contraoferta Recibida'; // Así lo leerá el usuario en su panel
    }

    // 4. Enviar la actualización a Supabase
    try {
        console.log(`Procesando acción: ${accion} para el ID: ${citaActualId}...`);
        
        const { error } = await supabaseClient
            .from('citas_cliente')
            .update({ 
                estatus_cita: nuevoEstado, 
                respuesta_admin: mensajeAdmin 
            })
            .eq('id', citaActualId);

        if (error) {
            console.error("Error devuelto por Supabase:", error);
            alert("Hubo un error al intentar actualizar la oferta. Revisa la consola.");
            return;
        }

        // --- 4.5 LA MAGIA: SI EL ADMIN ACEPTA DIRECTO, SE MARCA COMO VENDIDA ---
        if (accion === 'aceptar') {
            const { data: citaData } = await supabaseClient
                .from('citas_cliente')
                .select('*')
                .eq('id', citaActualId)
                .single();

            // Buscamos cómo se llama la columna de tu casa en la base de datos
            const idDeLaCasa = citaData.solicitud_id || citaData.propiedad_id || citaData.solicitudes_publicacion_id;

            if (idDeLaCasa) {
                await supabaseClient
                    .from('solicitudes_publicacion')
                    .update({ estatus_revision: 'Vendida' }) // <-- Pone la etiqueta roja en el catálogo
                    .eq('id', idDeLaCasa);
            }
        }
        // -------------------------------------------------------------------

        // 5. ÉXITO: Limpieza y recarga
        
        // A) Limpiamos la caja de texto para la próxima vez
        mensajeInput.value = '';
        
        // B) Cerramos el modal usando Bootstrap (usando el ID real de tu modal)
        const modalElement = document.getElementById('modalOfertaAdmin');
        const modalInstance = bootstrap.Modal.getInstance(modalElement);
        if (modalInstance) {
            modalInstance.hide();
        }

        // C) Recargamos el panel para que la tarjeta cambie de color/estado inmediatamente
        if (typeof loadAdminDashboard === 'function') {
            loadAdminDashboard(); 
        } else {
            // Plan de respaldo por si loadAdminDashboard no está disponible
            location.reload(); 
        }

    } catch (err) {
        console.error("Error inesperado en procesarOferta:", err);
    }
}


// --- FUNCIONES DE NEGOCIACIÓN USUARIO ---
async function abrirModalNegociacion(id, casa, mensajeAdmin) {
    const idInput = document.getElementById('user-negoc-cita-id');
    const casaTxt = document.getElementById('user-negoc-casa-nombre');
    const mensajeTxt = document.getElementById('user-negoc-mensaje-admin');
    
    if(idInput) idInput.value = id;
    if(casaTxt) casaTxt.innerText = casa;
    if(mensajeTxt) mensajeTxt.innerText = mensajeAdmin;

    const modalElem = document.getElementById('modalNegociacionUsuario');
    if (modalElem) {
        const modal = new bootstrap.Modal(modalElem);
        modal.show();
    }
}

// --- FUNCIÓN DE RESPUESTA DEL INTERESADO (COMPRADOR) ---
async function procesarRespuestaUsuario(accion) {
    const citaId = document.getElementById('user-negoc-cita-id').value;
    const respuestaUsuario = document.getElementById('user-negoc-respuesta').value.trim();

    if (!citaId) return alert("Error: No se encontró el ID de la cita.");

    let nuevoEstatus = '';
    let mensajeFinal = '';

    // --- EL CAMBIO CLAVE ---
    if (accion === 'aceptar') {
        // En lugar de cerrar el trato, se lo devolvemos al vendedor como una oferta final aceptada
        nuevoEstatus = 'Oferta Recibida'; 
        mensajeFinal = "¡He aceptado tu contraoferta! Quedo a la espera de que cierres el trato.";
    }
    
    if (accion === 'rechazar') {
        nuevoEstatus = 'Oferta Rechazada';
        mensajeFinal = respuestaUsuario || "El interesado ha rechazado la propuesta.";
    }

    if (accion === 'contraoferta') {
        if (!respuestaUsuario) return alert("Por favor, escribe un mensaje con tu nueva propuesta.");
        nuevoEstatus = 'Oferta Recibida';
        mensajeFinal = respuestaUsuario;
    }

    try {
        const { error } = await supabaseClient
            .from('citas_cliente')
            .update({ 
                estatus_cita: nuevoEstatus,
                mensaje_oferta: mensajeFinal // Se guarda en mensaje_oferta para que el dueño lo lea
            })
            .eq('id', citaId);

        if (error) throw error;
        
        alert("¡Respuesta enviada! El propietario ha sido notificado para proceder.");
        location.reload();
    } catch (err) {
        console.error("Error en respuesta del usuario:", err);
        alert("Hubo un error al conectar con la base de datos.");
    }
}

// --- NUEVA LÓGICA: EL ADMIN CIERRA EL TRATO Y MARCA COMO VENDIDA ---
async function cerrarTrato(citaId) {
    const confirmar = confirm("¿Estás seguro de que deseas aceptar la oferta y marcar esta propiedad como TRATO CERRADO?");
    if (!confirmar) return;

    // 1. Cambiamos el estatus de la cita a Trato Cerrado
    const { error } = await supabaseClient
        .from('citas_cliente')
        .update({ estatus_cita: 'Trato Cerrado' })
        .eq('id', citaId);

    if (error) {
        alert("Error al cerrar el trato.");
    } else {
        
        // --- LA MAGIA: BUSCAMOS LA PROPIEDAD Y LA MARCAMOS COMO VENDIDA ---
        // Le pedimos a Supabase TODA la información de la cita para no fallar con el nombre de la columna
        const { data: citaData } = await supabaseClient
            .from('citas_cliente')
            .select('*') 
            .eq('id', citaId)
            .single();

        // Intentamos detectar automáticamente cómo se llama tu columna (solicitud_id o propiedad_id)
        const idDeLaCasa = citaData.solicitud_id || citaData.propiedad_id || citaData.solicitudes_publicacion_id;

        if (idDeLaCasa) {
            const { error: errUpdate } = await supabaseClient
                .from('solicitudes_publicacion')
                .update({ estatus_revision: 'Vendida' }) 
                .eq('id', idDeLaCasa);
                
            if (errUpdate) {
                console.error("Error al ponerle Vendida:", errUpdate);
            } else {
                console.log("¡Éxito! Casa actualizada a Vendida.");
            }
        } else {
            console.error("No se encontró el ID de la casa en la cita. Datos de la cita:", citaData);
        }
        // ------------------------------------------------------------------
        // ------------------------------------------------------------------

        alert("¡Felicidades! Has cerrado el trato. La propiedad ahora aparecerá con etiqueta de VENDIDA en el catálogo.");
        loadAdminDashboard();
    }
}

// ==========================================
// --- LÓGICA PARA REAGENDAR CITA (CLIENTE) ---
// ==========================================
let citaIdPendienteReagendar = null;

function abrirModalReagendar(citaId, nombreCasa) {
    citaIdPendienteReagendar = citaId;

    // Si el modal no existe, lo inyectamos al vuelo
    if (!document.getElementById('modalReagendarCita')) {
        const modalHTML = `
            <div class="modal fade" id="modalReagendarCita" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content shadow-lg border-0">
                        <div class="modal-header border-0 pb-0">
                            <h5 class="modal-title w-100 text-center fw-bold fs-4 text-dark">Reagendar Cita</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body pt-2 pb-4 px-4">
                            <p class="text-muted text-center mb-3">Selecciona una nueva fecha y hora para visitar <strong><span id="reagendarNombreCasa"></span></strong>.</p>
                            
                            <div class="mb-3 text-start">
                                <label class="form-label fw-bold">Nueva Fecha:</label>
                                <input type="date" id="reagendarFecha" class="form-control" required>
                            </div>
                            <div class="mb-4 text-start">
                                <label class="form-label fw-bold">Nueva Hora:</label>
                                <input type="time" id="reagendarHora" class="form-control" required>
                            </div>
                            
                            <button class="btn btn-primary w-100 py-3 fw-bold fs-5 shadow-sm" onclick="ejecutarReagendar()">
                                <i class="bi bi-send"></i> Enviar Nueva Solicitud
                            </button>
                            
                            <button class="btn btn-light w-100 mt-2 text-secondary" data-bs-dismiss="modal">
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // Ponemos el nombre de la casa en el texto
    document.getElementById('reagendarNombreCasa').innerText = nombreCasa;
    // Limpiamos los campos por si ya los había usado antes
    document.getElementById('reagendarFecha').value = '';
    document.getElementById('reagendarHora').value = '';

    // Abrimos el modal
    const modalOpciones = new bootstrap.Modal(document.getElementById('modalReagendarCita'));
    modalOpciones.show();
}

async function ejecutarReagendar() {
    const nuevaFecha = document.getElementById('reagendarFecha').value;
    const nuevaHora = document.getElementById('reagendarHora').value;

    if (!nuevaFecha || !nuevaHora) {
        alert("Por favor, selecciona una fecha y una hora válidas.");
        return;
    }

    const citaId = citaIdPendienteReagendar;
    if (!citaId) return;

    try {
        // Actualizamos la cita en Supabase: La regresamos a 'Pendiente', le ponemos 
        // la nueva fecha/hora y borramos tu mensaje de rechazo anterior para limpiar el historial.
        const { error } = await supabaseClient
            .from('citas_cliente')
            .update({ 
                estatus_cita: 'Pendiente',
                fecha_cita: nuevaFecha,
                hora_cita: nuevaHora,
                mensaje_admin: null 
            })
            .eq('id', citaId);

        if (error) throw error;

        alert("¡Cita reagendada con éxito! El administrador revisará tu nueva propuesta.");
        
        // Cerramos modal
        const modalEl = document.getElementById('modalReagendarCita');
        const modalInstancia = bootstrap.Modal.getInstance(modalEl);
        if (modalInstancia) modalInstancia.hide();

        // Recargamos el panel del cliente
        if (typeof loadClienteDashboard === 'function') {
            loadClienteDashboard();
        } else {
            location.reload();
        }

    } catch (error) {
        console.error("Error al reagendar:", error);
        alert("Hubo un error al intentar reagendar. Revisa la consola.");
    }
}

// ==========================================
// --- 26. ELIMINACIÓN TOTAL DE USUARIO (NUKE BLINDADO) ---
// ==========================================
window.eliminarUsuarioTotal = async function(userId, nombreUsuario) {
    if (!confirm(`¿ESTÁS SEGURO? Se borrará el perfil de ${nombreUsuario}, todas sus casas, fotos, citas y favoritos. No hay marcha atrás.`)) return;

    try {
        console.log("Iniciando purga total para:", userId);

        // 1. Obtener URLs de fotos y los IDs de sus casas
        const { data: solicitudes } = await supabaseClient
            .from('solicitudes_publicacion')
            .select('id, imagenes')
            .eq('propietario_id', userId);

        let todasLasFotos = [];
        let idsPropiedades = [];
        
        if (solicitudes) {
            solicitudes.forEach(s => {
                idsPropiedades.push(s.id);
                if (s.imagenes) todasLasFotos = todasLasFotos.concat(s.imagenes);
            });
        }

        // Borrar archivos del servidor si existen
        if (todasLasFotos.length > 0) {
            await borrarFotosStorage(todasLasFotos);
        }

        // 2. Limpieza de relaciones cruzadas en la base de datos
        // Borrar citas donde el usuario es el COMPRADOR
        await supabaseClient.from('citas_cliente').delete().eq('cliente_id', userId);
        
        // --- LO NUEVO P2P: Borrar citas donde el usuario es el DUEÑO (Vendedor) ---
        await supabaseClient.from('citas_cliente').delete().eq('vendedor_id', userId);
        
        // Borrar sus favoritos
        await supabaseClient.from('favoritos').delete().eq('usuario_id', userId);

        // Si el usuario subió casas, borramos todo lo que dependa de esas casas
        if (idsPropiedades.length > 0) {
            await supabaseClient.from('citas_cliente').delete().in('propiedad_id', idsPropiedades);
            await supabaseClient.from('inventario_publico').delete().in('solicitud_id', idsPropiedades);
            await supabaseClient.from('solicitudes_publicacion').delete().in('id', idsPropiedades);
        }

        // 3. EL GOLPE FINAL: Borrar el perfil (con .select() para confirmar)
        const { data: perfilBorrado, error: errFinal } = await supabaseClient
            .from('perfiles')
            .delete()
            .eq('id', userId)
            .select(); 

        if (errFinal) throw errFinal;

        // Si Supabase RLS lo bloquea, el array regresa vacío y lanzamos la alerta
        if (!perfilBorrado || perfilBorrado.length === 0) {
            throw new Error("⚠️ SUPABASE BLOQUEÓ EL BORRADO. Tienes que ir a tu base de datos y apagar el RLS (Row Level Security) en la tabla 'perfiles'.");
        }

        alert(`Usuario ${nombreUsuario} eliminado por completo del sistema.`);
        
        // Recargar la tabla para que ya no aparezca
        if (typeof loadAdminUsuarios === 'function') {
            loadAdminUsuarios();
        } else {
            location.reload();
        }

    } catch (err) {
        console.error("Error en eliminación total:", err);
        alert("Hubo un error al intentar borrar el perfil: " + err.message);
    }
};

// --- FUNCIONALIDADES DE UI ---
window.abrirModalOfertaPropietario = function(citaId, cliente, casa, mensaje) {
    // Si el modal no existe en el HTML del cliente, lo inyectamos al vuelo
    if (!document.getElementById('modalOfertaAdmin')) {
        const modalHTML = `
            <div class="modal fade" id="modalOfertaAdmin" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-0 shadow-lg">
                        <div class="modal-header bg-dark text-white border-0">
                            <h5 class="modal-title font-serif"><i class="bi bi-envelope-paper me-2"></i>Revisar Oferta</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body p-4">
                            <input type="hidden" id="admin-oferta-cita-id">
                            
                            <div class="bg-light p-3 rounded mb-3 border">
                                <p class="mb-1 small text-muted text-uppercase fw-bold">Propiedad</p>
                                <h6 id="admin-oferta-casa" class="fw-bold mb-3 text-dark"></h6>
                                
                                <p class="mb-1 small text-muted text-uppercase fw-bold">Interesado</p>
                                <h6 id="admin-oferta-cliente" class="fw-bold mb-3 text-dark"></h6>
                                
                                <p class="mb-1 small text-muted text-uppercase fw-bold">Mensaje / Oferta del cliente</p>
                                <p id="admin-oferta-mensaje" class="fst-italic border-start border-3 border-info ps-2 text-dark"></p>
                            </div>

                            <div class="mb-3">
                                <label class="form-label fw-bold text-primary-custom">Tu Respuesta al Cliente:</label>
                                <textarea id="admin-oferta-respuesta" class="form-control" rows="3" placeholder="Escribe aquí tu respuesta, condiciones o contraoferta..."></textarea>
                            </div>
                            
                            <div class="d-flex flex-column gap-2 mt-4">
                                <button class="btn btn-success fw-bold py-2 shadow-sm" onclick="procesarOferta('aceptar')">
                                    <i class="bi bi-check-circle me-1"></i> Aceptar Oferta y Cerrar Trato
                                </button>
                                <button class="btn btn-warning fw-bold py-2 shadow-sm text-dark" onclick="procesarOferta('contraoferta')">
                                    <i class="bi bi-arrow-left-right me-1"></i> Enviar Contraoferta
                                </button>
                                <button class="btn btn-outline-danger fw-bold py-2 shadow-sm" onclick="procesarOferta('rechazar')">
                                    <i class="bi bi-x-circle me-1"></i> Rechazar Oferta
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // Llenamos el modal con los datos exactos del interesado
    document.getElementById('admin-oferta-cita-id').value = citaId;
    document.getElementById('admin-oferta-cliente').innerText = cliente;
    document.getElementById('admin-oferta-casa').innerText = casa;
    document.getElementById('admin-oferta-mensaje').innerText = mensaje;
    document.getElementById('admin-oferta-respuesta').value = '';

    // Mostramos la ventana elegante de Bootstrap
    const modal = new bootstrap.Modal(document.getElementById('modalOfertaAdmin'));
    modal.show();
};

// --- FUNCIÓN DE LIMPIEZA EXCLUSIVA PARA EL COMPRADOR (SIN MENÚ DE VENTA) ---
window.eliminarCitaComprador = async function(citaId) {
    // Confirmación simple para evitar borrados accidentales
    const confirmar = confirm("¿Quieres quitar este registro de tu lista? (Esto no afecta el estatus de la casa en el catálogo)");
    
    if (!confirmar) return;

    try {
        // Borramos el registro directamente de la tabla
        const { error } = await supabaseClient
            .from('citas_cliente')
            .delete()
            .eq('id', citaId);

        if (error) throw error;

        // Recargamos el panel para que desaparezca la tarjeta
        loadClienteDashboard(); 

    } catch (error) {
        console.error("Error al quitar el registro:", error);
        alert("Hubo un error al intentar borrar la cita.");
    }
};