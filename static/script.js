document.addEventListener('DOMContentLoaded', () => {
    fetchFeed();
    fetchAiring();
    startAutoScroll();
});

const feedContainer = document.getElementById('animeFeed');
const airingContainer = document.getElementById('airingFeed');
const modal = document.getElementById('episodesModal');
const episodesList = document.getElementById('episodesList');
const modalTitle = document.getElementById('modalTitle');
const modalSynopsis = document.getElementById('modalSynopsis');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');

let autoScrollInterval = null;

// Watch History (localStorage)
function getWatchHistory() {
    try {
        return JSON.parse(localStorage.getItem('watchHistory') || '{}');
    } catch { return {}; }
}

function saveWatched(animeSlug, episodeNum) {
    const history = getWatchHistory();
    history[animeSlug] = { episode: episodeNum, timestamp: Date.now() };
    localStorage.setItem('watchHistory', JSON.stringify(history));
}

function getLastWatched(animeSlug) {
    const history = getWatchHistory();
    return history[animeSlug] || null;
}

// Toggle Agenda visibility with back button
window.toggleAgenda = function () {
    const agenda = document.getElementById('airingFeed');
    const feed = document.getElementById('animeFeed');

    if (agenda.style.display === 'none' || !agenda.style.display) {
        agenda.style.display = 'block';
        feed.style.display = 'none';
    } else {
        agenda.style.display = 'none';
        feed.style.display = 'block';
    }
};

// Back to Feed
window.backToFeed = function () {
    const agenda = document.getElementById('airingFeed');
    const feed = document.getElementById('animeFeed');
    agenda.style.display = 'none';
    feed.style.display = 'block';
};

// Auto-scroll: advances to next slide every 5 seconds
function startAutoScroll() {
    autoScrollInterval = setInterval(() => {
        if (!feedContainer) return;
        const slideHeight = window.innerHeight;
        const currentScroll = feedContainer.scrollTop;
        const maxScroll = feedContainer.scrollHeight - feedContainer.clientHeight;

        if (currentScroll >= maxScroll - 10) {
            // Loop back to top
            feedContainer.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            feedContainer.scrollTo({ top: currentScroll + slideHeight, behavior: 'smooth' });
        }
    }, 5000); // Every 5 seconds
}

// Stop auto-scroll on user interaction
feedContainer?.addEventListener('touchstart', () => {
    clearInterval(autoScrollInterval);
    setTimeout(startAutoScroll, 10000); // Resume after 10s of inactivity
});
feedContainer?.addEventListener('wheel', () => {
    clearInterval(autoScrollInterval);
    setTimeout(startAutoScroll, 10000);
});


// Search
window.performSearch = async function () {
    const query = searchInput.value;
    const status = statusFilter ? statusFilter.value : '';

    if (!query && !status) {
        fetchFeed();
        return;
    }

    // Ensure we are showing the feed (hide agenda)
    const agenda = document.getElementById('airingFeed');
    const feed = document.getElementById('animeFeed');
    if (agenda) agenda.style.display = 'none';
    if (feed) feed.style.display = 'block';

    // Skeleton for Search
    feedContainer.innerHTML = `
        <div class="search-results-grid">
            ${Array(8).fill(0).map(() => `
                <div class="search-result-item">
                    <div class="skeleton" style="width:100%; aspect-ratio:2/3; border-radius:12px;"></div>
                    <div class="skeleton" style="height:15px; width:80%; margin-top:10px;"></div>
                </div>
            `).join('')}
        </div>
    `;

    try {
        let url = `/api/search?q=${encodeURIComponent(query)}`;
        if (status) url += `&status=${status}`;

        const response = await fetch(url);
        const animes = await response.json();
        renderSearchResults(animes);
    } catch (error) {
        console.error('Search error:', error);
        feedContainer.innerHTML = '<p style="text-align:center; padding-top:100px; color:white;">Error en la búsqueda</p>';

        // Add back button even on error
        const backBtn = document.createElement('button');
        backBtn.className = 'back-to-feed-btn bottom-btn';
        backBtn.innerHTML = '<i class="fas fa-arrow-left"></i> Volver al Feed';
        backBtn.onclick = () => { searchInput.value = ''; fetchFeed(); };
        feedContainer.appendChild(backBtn);
    }
};

async function fetchFeed() {
    feedContainer.innerHTML = '<div class="loading-screen"><i class="fas fa-spinner fa-spin"></i> Cargando Feed...</div>';
    try {
        const response = await fetch('/api/feed');
        const animes = await response.json();
        renderAnimes(animes);
    } catch (error) {
        console.error('Error fetching feed:', error);
        feedContainer.innerHTML = '<div class="loading-screen"><h2>Error de conexión</h2></div>';
    }
}

async function fetchAiring() {
    if (!airingContainer) return;
    try {
        const response = await fetch('/api/airing');
        const animes = await response.json();
        renderAiringByDay(animes);
    } catch (error) {
        console.error('Error fetching airing:', error);
    }
}

function renderAnimes(animes) {
    feedContainer.innerHTML = '';
    if (!animes || animes.length === 0) {
        feedContainer.innerHTML = '<div class="loading-screen"><h2>No hay novedades</h2></div>';
        return;
    }

    animes.forEach(anime => {
        const slide = createAnimeSlide(anime);
        feedContainer.appendChild(slide);
    });
}

function renderSearchResults(animes) {
    feedContainer.innerHTML = '';

    if (!animes || animes.length === 0) {
        feedContainer.innerHTML = '<div class="loading-screen" style="height:50vh;"><h2>No se encontraron resultados</h2></div>';

        const backBtn = document.createElement('button');
        backBtn.className = 'back-to-feed-btn bottom-btn';
        backBtn.innerHTML = '<i class="fas fa-arrow-left"></i> Volver al Feed';
        backBtn.onclick = () => { searchInput.value = ''; fetchFeed(); };
        feedContainer.appendChild(backBtn);
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'search-results-grid';

    animes.forEach(anime => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.onclick = () => openProfile(anime.slug, anime.title);
        item.innerHTML = `
            <img src="${anime.image_url}" alt="${anime.title}">
            <div class="search-result-title">${anime.title}</div>
            <div class="search-result-type">${anime.type}</div>
        `;
        grid.appendChild(item);
    });

    feedContainer.appendChild(grid);

    // Add back button at the bottom
    const backBtn = document.createElement('button');
    backBtn.className = 'back-to-feed-btn bottom-btn';
    backBtn.innerHTML = '<i class="fas fa-arrow-left"></i> Volver al Feed';
    backBtn.onclick = () => {
        searchInput.value = '';
        fetchFeed();
    };
    feedContainer.appendChild(backBtn);
}

function renderAiringByDay(animes) {
    airingContainer.innerHTML = '';
    if (!animes || animes.length === 0) return;

    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const today = new Date();
    const todayIndex = (today.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0
    const todayName = days[todayIndex];
    const grouped = {};

    days.forEach(d => grouped[d] = []);
    animes.forEach(anime => {
        if (grouped[anime.day]) grouped[anime.day].push(anime);
    });

    days.forEach(day => {
        if (grouped[day].length === 0) return;

        const section = document.createElement('div');
        section.className = 'day-section';
        section.innerHTML = `<h3 class="day-header">${day}${day === todayName ? ' (Hoy)' : ''}</h3>`;

        const row = document.createElement('div');
        row.className = 'day-row';

        grouped[day].forEach(anime => {
            const item = document.createElement('div');
            item.className = 'airing-item';
            item.onclick = () => openProfile(anime.slug, anime.title);

            // Check if episode is available (today or past days = available)
            const dayIndex = days.indexOf(anime.day);
            const isAvailable = dayIndex <= todayIndex;
            const statusText = isAvailable ? 'Ep. Disponible' : 'Próximamente';
            const statusClass = isAvailable ? 'status-available' : 'status-upcoming';

            // Check last watched
            const lastWatched = getLastWatched(anime.slug);
            const lastWatchedText = lastWatched ? `<div class="last-watched">Viste EP ${lastWatched.episode}</div>` : '';

            item.innerHTML = `
                <img src="${anime.image_url}" alt="${anime.title}">
                <div class="airing-title">${anime.title}</div>
                <div class="airing-status ${statusClass}">${statusText}</div>
                ${lastWatchedText}
            `;
            row.appendChild(item);
        });

        section.appendChild(row);
        airingContainer.appendChild(section);
    });

    // Add back button at the bottom
    const backBtn = document.createElement('button');
    backBtn.className = 'back-to-feed-btn bottom-btn';
    backBtn.innerHTML = '<i class="fas fa-arrow-left"></i> Volver al Feed';
    backBtn.onclick = backToFeed;
    airingContainer.appendChild(backBtn);
}

function createAnimeSlide(anime) {
    const div = document.createElement('div');
    div.className = 'anime-slide';
    div.style.backgroundImage = `url('${anime.image_url}')`;

    const infoDiv = document.createElement('div');
    infoDiv.className = 'anime-info';
    infoDiv.innerHTML = `
        <div class="anime-score">${anime.type || 'Anime'}</div>
        <h1 class="anime-title">${anime.title}</h1>
        ${anime.episode ? `<div style="color:var(--primary-color); font-weight:bold; margin-bottom:10px;">Episodio ${anime.episode}</div>` : ''}
        <p>${anime.synopsis ? anime.synopsis.substring(0, 80) + '...' : ''}</p>
        <button class="view-profile-btn" onclick="openProfile('${anime.slug}', '${anime.title.replace(/'/g, "\\'")}')">
            <i class="fas fa-info-circle"></i> Ver Detalles
        </button>
    `;

    div.appendChild(infoDiv);
    return div;
}

// Track current episode and episode list for navigation
let currentEpisodeInfo = { animeSlug: '', animeTitle: '', episodeNum: 1 };
let currentAnimeEpisodes = [];

window.openProfile = async (id, title) => {
    modal.style.display = 'block';
    modalTitle.textContent = title;

    // Skeleton Loader for Profile
    modalSynopsis.innerHTML = `
        <div class="skeleton" style="height:15px; width:90%; margin-bottom:10px;"></div>
        <div class="skeleton" style="height:15px; width:95%; margin-bottom:10px;"></div>
        <div class="skeleton" style="height:15px; width:70%;"></div>
    `;
    episodesList.innerHTML = Array(5).fill(0).map(() => `
        <div class="episode-item">
            <div class="skeleton" style="height:40px; width:100%; border-radius:30px;"></div>
        </div>
    `).join('');

    try {
        const response = await fetch(`/api/anime/${id}`);
        const info = await response.json();
        modalSynopsis.textContent = info.synopsis || 'Sin sinopsis.';
        currentAnimeEpisodes = info.episodes || []; // Store episodes for next navigation
        renderEpisodes(currentAnimeEpisodes, info.title);
    } catch (error) {
        console.error('Error fetching anime info:', error);
        modalSynopsis.textContent = 'Error al cargar la información.';
    }
};

function renderEpisodes(episodes, animeTitle) {
    if (!episodes || episodes.length === 0) {
        episodesList.innerHTML = '<p>No hay episodios.</p>';
        return;
    }

    episodesList.innerHTML = episodes.map(ep => {
        const slug = ep.url.split('ver/')[1];
        return `
        <div class="episode-item">
            <span style="font-weight:bold; color:var(--primary-color);">EP ${ep.number}</span>
            <button onclick="openVideo('${slug}', 'Episodio ${ep.number} - ${animeTitle}')" class="view-profile-btn" style="padding: 5px 10px; font-size: 0.8rem;">
                <i class="fas fa-play"></i> Reproducir
            </button>
        </div>
    `}).join('');
}

const videoModal = document.getElementById('videoModal');
const videoFrame = document.getElementById('videoFrame');
const videoTitle = document.getElementById('videoTitle');
const serverListContainer = document.getElementById('serverList');

window.openVideo = async (slug, title) => {
    videoModal.style.display = 'block';
    videoTitle.textContent = title;
    videoFrame.style.display = 'none';
    videoFrame.src = '';
    serverListContainer.innerHTML = '<div style="color:white; padding:10px;"><i class="fas fa-spinner fa-spin"></i></div>';

    // Extract anime slug and episode number from slug (e.g., "anime-name-12" -> animeSlug="anime-name", ep=12)
    const parts = slug.split('-');
    const epNum = parseInt(parts.pop()) || 1;
    const animeSlug = parts.join('-');

    // Store for navigation
    currentEpisodeInfo = {
        animeSlug,
        animeTitle: title.replace(/Episodio \d+ - /, ''),
        episodeNum: epNum
    };

    saveWatched(animeSlug, epNum);

    try {
        const res = await fetch(`/api/episode/${slug}`);
        const data = await res.json();
        renderServers(data.servers);
    } catch (e) {
        console.error(e);
    }
};

// Navigate back to anime profile to select episodes
window.backToAnimeProfile = function () {
    closeVideoModal();
    if (currentEpisodeInfo.animeSlug) {
        openProfile(currentEpisodeInfo.animeSlug, currentEpisodeInfo.animeTitle);
    }
};

// Go to next episode
window.nextEpisode = function () {
    if (!currentAnimeEpisodes || currentAnimeEpisodes.length === 0) {
        // Fallback to slug increment if no list
        const nextEp = currentEpisodeInfo.episodeNum + 1;
        const nextSlug = `${currentEpisodeInfo.animeSlug}-${nextEp}`;
        const nextTitle = `Episodio ${nextEp} - ${currentEpisodeInfo.animeTitle}`;
        openVideo(nextSlug, nextTitle);
        return;
    }

    // Find current index and get next
    const currentIndex = currentAnimeEpisodes.findIndex(ep => ep.number == currentEpisodeInfo.episodeNum);
    // AnimeFLV usually lists episodes from newest to oldest (descending)
    // So next episode (higher number) usually has lower index
    const nextEpObj = currentAnimeEpisodes.find(ep => ep.number == currentEpisodeInfo.episodeNum + 1);

    if (nextEpObj) {
        const slug = nextEpObj.url.split('ver/')[1];
        openVideo(slug, `Episodio ${nextEpObj.number} - ${currentEpisodeInfo.animeTitle}`);
    } else {
        alert('No hay más episodios disponibles por ahora.');
    }
};

function renderServers(servers) {
    serverListContainer.innerHTML = '';
    if (!servers || servers.length === 0) {
        serverListContainer.innerHTML = 'No servers';
        return;
    }

    servers.forEach(srv => {
        const btn = document.createElement('button');
        btn.className = 'server-btn';
        btn.textContent = srv.server;
        btn.onclick = () => {
            document.querySelectorAll('.server-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            videoFrame.src = srv.url;
            videoFrame.style.display = 'block';
        };
        serverListContainer.appendChild(btn);
    });
}

window.closeVideoModal = () => {
    videoModal.style.display = 'none';
    videoFrame.src = '';
};

window.closeModal = () => {
    modal.style.display = 'none';
};

window.onclick = (event) => {
    if (event.target == modal) modal.style.display = 'none';
    if (event.target == videoModal) closeVideoModal();
};
