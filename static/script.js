document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    renderContinueWatching();
});

// Elementos DOM
const homeView = document.getElementById('homeView');
const secondaryView = document.getElementById('secondaryView');
const heroSlider = document.getElementById('heroSlider');
const feedGrid = document.getElementById('feedGrid');
const secondaryGrid = document.getElementById('secondaryGrid');
const secondaryTitle = document.getElementById('secondaryTitle');

// --- Control de Vistas ---
function showHome() {
    secondaryView.classList.add('hidden');
    homeView.classList.remove('hidden');
    window.scrollTo(0, 0);
}

function showSecondary(title) {
    homeView.classList.add('hidden');
    secondaryView.classList.remove('hidden');
    secondaryTitle.textContent = title;
    window.scrollTo(0, 0);
}

window.backToHome = showHome;

// --- Data Fetching & Rendering ---

async function fetchData() {
    try {
        const response = await fetch('/api/feed');
        const animes = await response.json();

        // 1. Render Slider (Top 5)
        renderSlider(animes.slice(0, 5));

        // 2. Render Grid (Todos)
        renderGrid(animes, feedGrid);

    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

// Lógica del Slider Hero (CON EFECTO BLUR)
let sliderInterval;
function renderSlider(topAnimes) {
    heroSlider.innerHTML = '';

    topAnimes.forEach((anime, index) => {
        const slide = document.createElement('div');
        // AÑADIDO: 'overflow-hidden' para contener el blur y 'absolute inset-0'
        // ELIMINADO: 'bg-cover bg-center' del contenedor padre
        slide.className = `fade-slide ${index === 0 ? 'active' : ''} w-full h-full absolute inset-0 overflow-hidden`;

        slide.innerHTML = `
            <div class="absolute inset-0 bg-cover bg-center transition-transform duration-10000 ease-linear transform scale-110" 
                 style="background-image: url('${anime.image_url}'); filter: blur(4px);">
            </div>

            <div class="absolute inset-0 bg-black/30"></div>

            <div class="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent"></div>
            <div class="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent"></div>
            
            <div class="absolute bottom-0 left-0 p-6 md:p-12 md:pb-24 w-full max-w-3xl z-10">
                <div class="mb-2 flex items-center gap-2 animate-slide-up">
                     <span class="px-2 py-1 bg-primary text-white text-[10px] font-bold rounded shadow-lg shadow-primary/50">NUEVO EPISODIO ${anime.episode}</span>
                </div>
                <h1 class="text-3xl md:text-5xl font-black text-white mb-4 leading-tight drop-shadow-xl animate-slide-up" style="animation-delay: 100ms;">
                    ${anime.title}
                </h1>
                <p class="text-gray-200 text-sm md:text-base line-clamp-2 mb-6 max-w-xl animate-slide-up font-medium" style="animation-delay: 200ms;">
                    Disfruta del último capítulo en alta definición. Disponible ahora en múltiples servidores.
                </p>
                <button onclick="openProfile('${anime.slug}', '${anime.title.replace(/'/g, "\\'")}')" 
                    class="bg-white text-black px-8 py-3 rounded-full font-bold hover:bg-gray-200 transition-transform transform hover:scale-105 flex items-center gap-2 animate-slide-up shadow-xl" style="animation-delay: 300ms;">
                    <i class="fas fa-play"></i> Ver Ahora
                </button>
            </div>
        `;
        heroSlider.appendChild(slide);
    });

    // Iniciar rotación
    startSliderRotation(topAnimes.length);
}

function startSliderRotation(count) {
    if (sliderInterval) clearInterval(sliderInterval);
    let current = 0;
    const slides = document.querySelectorAll('.fade-slide');

    sliderInterval = setInterval(() => {
        slides[current].classList.remove('active');
        current = (current + 1) % count;
        slides[current].classList.add('active');
    }, 6000); // 6 segundos por slide
}

// Lógica de Grillas (Cards)
function createCardHTML(anime, isEpisode = false) {
    // Card oscura con efecto response (zoom)
    return `
        <div class="group cursor-pointer" onclick="openProfile('${anime.slug}', '${anime.title.replace(/'/g, "\\'")}')">
            <div class="relative w-full aspect-[2/3] rounded-lg overflow-hidden bg-surfaceHover mb-3 shadow-lg">
                <img src="${anime.image_url}" alt="${anime.title}" loading="lazy" 
                    class="w-full h-full object-cover transform transition-transform duration-500 group-hover:scale-110 group-hover:brightness-110">
                
                <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <div class="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shadow-lg transform scale-50 group-hover:scale-100 transition-transform duration-300">
                        <i class="fas fa-play ml-0.5"></i>
                    </div>
                </div>

                ${anime.episode ? `<div class="absolute top-2 right-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold rounded border border-white/10">EP ${anime.episode}</div>` : ''}
            </div>
            <h3 class="text-white text-sm font-semibold truncate group-hover:text-primary transition-colors">${anime.title}</h3>
            <p class="text-gray-500 text-xs mt-0.5">${isEpisode ? 'Recién añadido' : (anime.type || 'Anime')}</p>
        </div>
    `;
}

function renderGrid(list, container) {
    container.innerHTML = list.map(item => createCardHTML(item)).join('');
}

// --- Funcionalidades: Búsqueda, Agenda, Favoritos ---

window.performSearch = async function() {
    const query = document.getElementById('searchInput').value;
    if(!query) return;

    showSecondary(`Resultados: "${query}"`);
    secondaryGrid.innerHTML = '<div class="col-span-full text-center py-20"><i class="fas fa-circle-notch fa-spin text-primary text-2xl"></i></div>';

    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        renderGrid(data, secondaryGrid);
    } catch(e) { console.error(e); }
};

window.toggleAgenda = async function() {
    showSecondary('Agenda Semanal');
    secondaryGrid.innerHTML = '<div class="col-span-full text-center py-20"><i class="fas fa-circle-notch fa-spin text-primary text-2xl"></i></div>';
    try {
        const res = await fetch('/api/airing');
        const data = await res.json();
        secondaryGrid.innerHTML = data.map(item => createCardHTML(item, true)).join('');
    } catch(e) { console.error(e); }
};

window.toggleFavorites = function() {
    showSecondary('Mis Favoritos');
    const favs = getFavorites();
    if(favs.length === 0) {
        secondaryGrid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-20">No tienes favoritos aún.</div>';
    } else {
        renderGrid(favs, secondaryGrid);
    }
};

// --- Historial y Favoritos Logic ---

function getFavorites() { return JSON.parse(localStorage.getItem('favorites') || '[]'); }
function isFavorite(slug) { return getFavorites().some(f => f.slug === slug); }

function toggleFavorite(anime) {
    let favs = getFavorites();
    const idx = favs.findIndex(f => f.slug === anime.slug);
    if(idx > -1) favs.splice(idx, 1);
    else favs.push(anime);
    localStorage.setItem('favorites', JSON.stringify(favs));

    const btn = document.getElementById('favToggleBtn');
    if(btn) updateFavBtn(isFavorite(anime.slug));
}

function updateFavBtn(isFav) {
    const btn = document.getElementById('favToggleBtn');
    if(isFav) {
        btn.classList.add('bg-secondary', 'text-white', 'border-transparent');
        btn.classList.remove('text-gray-400', 'border-white/10');
        btn.innerHTML = '<i class="fas fa-heart"></i> Favorito';
    } else {
        btn.classList.remove('bg-secondary', 'text-white', 'border-transparent');
        btn.classList.add('text-gray-400', 'border-white/10');
        btn.innerHTML = '<i class="far fa-heart"></i> Favoritos';
    }
}

// Historial "Continuar Viendo"
function renderContinueWatching() {
    const history = JSON.parse(localStorage.getItem('watchHistory') || '{}');
    const slugs = Object.keys(history).sort((a,b) => history[b].timestamp - history[a].timestamp);
    const container = document.getElementById('continueWatching');
    const list = document.getElementById('historyList');

    if(slugs.length === 0) { container.classList.add('hidden'); return; }

    container.classList.remove('hidden');
    list.innerHTML = '';

    slugs.slice(0, 10).forEach(slug => {
        const item = history[slug];
        const lastEp = Math.max(...item.episodes);

        const card = document.createElement('div');
        card.className = "flex-shrink-0 w-32 cursor-pointer group";
        card.onclick = () => openVideo(`${slug}-${lastEp}`, `${slug}`);

        card.innerHTML = `
            <div class="w-full h-20 rounded bg-surfaceHover border border-white/5 relative flex items-center justify-center overflow-hidden group-hover:border-primary/50 transition-colors">
                <i class="fas fa-play text-gray-500 group-hover:text-primary transition-colors"></i>
                <div class="absolute bottom-1 right-2 text-[10px] font-mono text-gray-400">EP ${lastEp}</div>
            </div>
            <p class="text-xs text-gray-400 mt-1 truncate px-1">${slug}</p>
        `;
        list.appendChild(card);
    });
}

function saveWatched(animeSlug, epNum) {
    const history = JSON.parse(localStorage.getItem('watchHistory') || '{}');
    if(!history[animeSlug]) history[animeSlug] = { episodes: [], timestamp: 0 };
    if(!history[animeSlug].episodes.includes(epNum)) history[animeSlug].episodes.push(epNum);
    history[animeSlug].timestamp = Date.now();
    localStorage.setItem('watchHistory', JSON.stringify(history));
    renderContinueWatching();
}

// --- Modales ---
const modal = document.getElementById('episodesModal');
const videoModal = document.getElementById('videoModal');
let currentAnimeEps = [];
let currentEpInfo = {};

window.openProfile = async (slug, title) => {
    modal.classList.remove('hidden');

    // Reset UI
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalCover').style.backgroundImage = 'none';
    document.getElementById('modalCover').classList.add('bg-surfaceHover');
    document.getElementById('episodesList').innerHTML = '<div class="text-center py-4 text-gray-500"><i class="fas fa-circle-notch fa-spin"></i></div>';

    const favBtn = document.getElementById('favToggleBtn');
    updateFavBtn(isFavorite(slug));
    favBtn.onclick = () => toggleFavorite({slug, title, image_url: ''});

    try {
        const res = await fetch(`/api/anime/${slug}`);
        const data = await res.json();
        currentAnimeEps = data.episodes || [];

        document.getElementById('modalSynopsis').textContent = data.synopsis || 'No disponible';
        document.getElementById('modalStatus').textContent = (data.status || 'FINALIZADO').toUpperCase();
        document.getElementById('modalType').textContent = (data.type || 'TV').toUpperCase();

        if(data.image_url) {
            document.getElementById('modalCover').style.backgroundImage = `url('${data.image_url}')`;
            document.getElementById('modalCover').classList.remove('bg-surfaceHover');
            favBtn.onclick = () => toggleFavorite({slug, title, image_url: data.image_url});
        }

        document.getElementById('episodesList').innerHTML = currentAnimeEps.map(ep => {
            const epSlug = ep.url.split('ver/')[1];
            return `
                <div onclick="openVideo('${epSlug}', 'Episodio ${ep.number}')" 
                     class="flex justify-between items-center p-3 rounded bg-surfaceHover hover:bg-white/10 cursor-pointer transition-colors group">
                    <span class="text-sm font-medium text-gray-300 group-hover:text-white">Episodio ${ep.number}</span>
                    <i class="fas fa-play text-xs text-gray-500 group-hover:text-primary"></i>
                </div>
            `;
        }).join('');

    } catch(e) { console.error(e); }
};

window.openVideo = async (slug, title) => {
    videoModal.classList.remove('hidden');
    const serverList = document.getElementById('serverList');
    serverList.innerHTML = '<span class="text-xs text-gray-500">Cargando...</span>';

    const parts = slug.split('-');
    const epNum = parseInt(parts.pop());
    const animeSlug = parts.join('-');
    currentEpInfo = { animeSlug, epNum };
    saveWatched(animeSlug, epNum);

    try {
        const res = await fetch(`/api/episode/${slug}`);
        const data = await res.json();

        serverList.innerHTML = '';
        if(data.servers && data.servers.length) {
            data.servers.forEach((srv, i) => {
                const btn = document.createElement('button');
                btn.className = `px-3 py-1 rounded text-xs whitespace-nowrap border ${i===0 ? 'bg-primary text-white border-transparent' : 'border-gray-600 text-gray-400 hover:text-white'}`;
                btn.textContent = srv.server;
                btn.onclick = () => {
                    document.getElementById('videoFrame').src = srv.url;
                    Array.from(serverList.children).forEach(b => b.classList.replace('bg-primary', 'border-gray-600'));
                    Array.from(serverList.children).forEach(b => b.classList.remove('text-white'));
                    btn.classList.add('bg-primary', 'text-white');
                    btn.classList.remove('border-gray-600', 'text-gray-400');
                };
                serverList.appendChild(btn);
                if(i===0) document.getElementById('videoFrame').src = srv.url;
            });
        }
    } catch(e) { console.error(e); }
};

window.closeModal = () => modal.classList.add('hidden');
window.closeVideoModal = () => {
    videoModal.classList.add('hidden');
    document.getElementById('videoFrame').src = '';
};
window.nextEpisode = () => {
    const next = currentAnimeEps.find(e => e.number == currentEpInfo.epNum + 1);
    if(next) openVideo(next.url.split('ver/')[1], `Episodio ${next.number}`);
    else alert('Es el último episodio.');
};