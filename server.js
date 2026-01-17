const express = require('express');
const cors = require('cors');
const { getLatest, searchAnime } = require('animeflv-api');
const cloudscraper = require('cloudscraper');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.static('static'));
app.use(express.static('templates'));

// Helper to get high quality covers
function optimizeImageUrl(url) {
    if (!url) return url;
    // Replace thumbnails with covers and ensure www3 domain for consistency
    return url
        .replace('/thumbs/', '/covers/')
        .replace('/thumb/', '/covers/')
        .replace('//animeflv.net', '//www3.animeflv.net');
}

// Endpoint: Feed (Episodios Recientes)
app.get('/api/feed', async (req, res) => {
    try {
        const feed = await getLatest();
        // AnimeFLV devuelve lista de episodios recientes
        // Mapeamos a estructura comun
        const items = feed.map(item => ({
            title: item.title,
            episode: item.chapter,
            image_url: optimizeImageUrl(item.img || item.cover),
            url: item.url,
            slug: item.url.split('/').pop().replace(/-\d+$/, '')
        }));
        res.json(items);
    } catch (error) {
        console.error('Error feed:', error);
        res.status(500).json([]);
    }
});

// Endpoint: Búsqueda
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.json([]);

    try {
        const results = await searchAnime(query);
        const list = results.data || [];

        const items = list.map(item => ({
            title: item.title,
            image_url: optimizeImageUrl(item.cover),
            url: item.url,
            slug: item.id,
            type: item.type,
            year: item.year,
            // Status is not always available in quick search, but we check if we can get it
            // For now, simple return
        }));
        res.json(items);
    } catch (error) {
        console.error('Error search:', error);
        res.status(500).json([]);
    }
});

// Endpoint: En Emisión (Agenda por Días)
app.get('/api/airing', async (req, res) => {
    try {
        const url = 'https://www3.animeflv.net/browse?status=1&order=default';
        const html = await cloudscraper.get(url);
        const $ = cheerio.load(html);

        const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        const items = [];

        $('.ListAnimes article.Anime').each((i, el) => {
            const title = $(el).find('h3.Title').text().trim();
            const type = $(el).find('span.Type').text().trim();
            const imgSrc = $(el).find('.Image img').attr('src') || '';
            const link = $(el).find('a').attr('href');
            const slug = link.split('/').pop();

            // Assign a day based on index (simulated schedule)
            const day = days[i % 7];

            // Fix image URL: if already absolute, use it; otherwise prepend base
            let image_url = imgSrc;
            if (imgSrc && !imgSrc.startsWith('http')) {
                image_url = 'https://www3.animeflv.net' + imgSrc;
            }

            items.push({
                title,
                type,
                image_url: optimizeImageUrl(image_url),
                slug,
                day
            });
        });

        res.json(items);
    } catch (error) {
        console.error('Error airing:', error);
        res.status(500).json([]);
    }
});

// Endpoint: Get Episode Servers (Scrape video players)
app.get('/api/episode/:slug', async (req, res) => {
    const { slug } = req.params; // e.g., one-piece-1100
    const url = `https://www3.animeflv.net/ver/${slug}`;

    try {
        const html = await cloudscraper.get(url);
        const $ = cheerio.load(html);

        // Extract Title usually in breadcrumbs or standard location
        const title = $('.CapiTop .Title').text().trim() || slug;

        let servers = [];
        $('script').each((i, el) => {
            const content = $(el).html();
            if (content && content.includes('var videos =')) {
                try {
                    // var videos = {"SUB":[...servers...]};
                    const match = content.match(/var videos = (\{.*?\});/);
                    if (match) {
                        const json = JSON.parse(match[1]);
                        // Usually keys are "SUB", "LAT", etc.
                        // We map all of them
                        Object.keys(json).forEach(lang => {
                            json[lang].forEach(srv => {
                                servers.push({
                                    server: srv.server, // "Mega", "Netu", etc.
                                    title: srv.title,
                                    url: srv.code.replace(/\\/g, ''), // often iframe code or direct url
                                    lang: lang
                                });
                            });
                        });
                    }
                } catch (e) {
                    console.error('Error parsing videos var:', e);
                }
            }
        });

        // Clean up URLs
        // If 'url' is an IFRAME string, extract the src
        servers = servers.map(s => {
            if (s.url.startsWith('<iframe')) {
                const srcMatch = s.url.match(/src="([^"]+)"/);
                if (srcMatch) return { ...s, url: srcMatch[1] };
            }
            return s;
        });

        res.json({ title, servers });

    } catch (error) {
        console.error('Error episode servers:', error);
        res.status(500).json({ error: 'Failed to fetch episode servers' });
    }
});

// Endpoint: Detalles (Simplificado)
// getAnimeInfo esta roto en la libreria, devolvemos info basica o error controlado
// Custom Scraper function for Anime Info + Episodes
async function getAnimeInfoRobust(slug) {
    const url = `https://www3.animeflv.net/anime/${slug}`;
    console.log(`Scraping Anime: ${url}`);

    try {
        const html = await cloudscraper.get(url);
        const $ = cheerio.load(html);

        // Info Básica
        const title = $('h1.Title').text().trim();
        const synopsis = $('.Description p').text().trim();
        const score = $('#votes_prmd').text().trim();
        const type = $('span.Type').text().trim();
        const genres = $('nav.Nvgnrs a').map((i, el) => $(el).text()).get();
        const image_url = optimizeImageUrl('https://www3.animeflv.net' + $('.AnimeCover img').attr('src'));

        // Extraer Episodios
        let episodes = [];
        $('script').each((i, el) => {
            const content = $(el).html();
            if (content && content.includes('var episodes =')) {
                try {
                    // var episodes = [[1070,169123456],[...]];
                    const match = content.match(/var episodes = (\[\[.*?\]\]);/);
                    if (match) {
                        const jsonStr = match[1];
                        const rawEps = JSON.parse(jsonStr);
                        // Mapear [numero, id_interno] -> { number: numero, url: ... }
                        // Ordenamos de mayor a menor (ya suelen venir asi, pero confirmamos)
                        episodes = rawEps.map(e => ({
                            number: e[0],
                            // Generamos URL directa al episodio: /ver/slug-numero
                            url: `https://www3.animeflv.net/ver/${slug}-${e[0]}`
                        })).sort((a, b) => b.number - a.number);
                    }
                } catch (err) {
                    console.log('Error parsing episodes:', err.message);
                }
            }
        });

        return { title, synopsis, score, type, genres, image_url, episodes };
    } catch (e) {
        console.error('Error info:', e.message);
        return null;
    }
}

// Simple in-memory cache
const animeCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Endpoint: Detalles del Anime (Restaurado con Scraper)
app.get('/api/anime/:id', async (req, res) => {
    const id = req.params.id; // slug

    // Check cache
    if (animeCache.has(id)) {
        const cached = animeCache.get(id);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            console.log(`Cache Hit for: ${id}`);
            return res.json(cached.data);
        }
        animeCache.delete(id);
    }

    try {
        const info = await getAnimeInfoRobust(id);
        if (info) {
            // Save to cache
            animeCache.set(id, {
                data: info,
                timestamp: Date.now()
            });
            res.json(info);
        } else {
            res.status(404).json({ error: 'Anime not found' });
        }
    } catch (error) {
        console.error('Error info endpoint:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando en el puerto ${PORT}`);
});
