const express = require('express');
const cors = require('cors');
const { getLatest, searchAnime } = require('animeflv-api');
const cloudscraper = require('cloudscraper');
const cheerio = require('cheerio');
const path = require('path');
const NodeCache = require('node-cache');

const app = express();
const PORT = process.env.PORT || 8000;

// Configuración de Caché
const cache = new NodeCache({ stdTTL: 300, checkperiod: 120 });

app.use(cors());
app.use(express.static('static'));
app.use(express.static('templates'));

// --- Helpers ---

function optimizeImageUrl(url) {
    if (!url) return url;
    return url
        .replace('/thumbs/', '/covers/')
        .replace('/thumb/', '/covers/')
        .replace('//animeflv.net', '//www3.animeflv.net');
}

async function getCachedData(key, fetchFunction, ttl = 300) {
    const cachedData = cache.get(key);
    if (cachedData) return cachedData;

    try {
        const data = await fetchFunction();
        if (data) cache.set(key, data, ttl);
        return data;
    } catch (error) {
        console.error(`Error fetching data for key ${key}:`, error.message);
        throw error;
    }
}

// --- Endpoints ---

// 1. Feed (Home)
app.get('/api/feed', async (req, res) => {
    try {
        const items = await getCachedData('feed_latest', async () => {
            const feed = await getLatest();
            return feed.map(item => ({
                title: item.title,
                episode: item.chapter,
                image_url: optimizeImageUrl(item.img || item.cover),
                url: item.url,
                slug: item.url.split('/').pop().replace(/-\d+$/, '')
            }));
        }, 300);

        res.json(items);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo el feed' });
    }
});

// 2. Búsqueda
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.json([]);
    const cacheKey = `search_${query.toLowerCase().trim()}`;

    try {
        const items = await getCachedData(cacheKey, async () => {
            const results = await searchAnime(query);
            const list = results.data || [];
            return list.map(item => ({
                title: item.title,
                image_url: optimizeImageUrl(item.cover),
                url: item.url,
                slug: item.id,
                type: item.type,
                year: item.year
            }));
        }, 600);

        res.json(items);
    } catch (error) {
        console.error('Error search:', error);
        res.status(500).json([]);
    }
});

// 3. DETALLE DEL ANIME (Scraping Manual para evitar 404)
app.get('/api/anime/:id', async (req, res) => {
    const { id } = req.params;
    const cacheKey = `anime_${id}`;

    try {
        const data = await getCachedData(cacheKey, async () => {
            const url = `https://www3.animeflv.net/anime/${id}`;
            const html = await cloudscraper.get(url);
            const $ = cheerio.load(html);

            const title = $('h1.Title').text().trim();
            const synopsis = $('.Description').text().trim();
            const status = $('.FaSt.Status').text().trim();
            const type = $('.FaSt.Type').text().trim();
            let cover = $('.Image img').attr('src');

            if (cover && !cover.startsWith('http')) {
                cover = 'https://www3.animeflv.net' + cover;
            }

            let episodes = [];
            $('script').each((i, el) => {
                const content = $(el).html();
                if (content && content.includes('var episodes =')) {
                    try {
                        const match = content.match(/var episodes = (\[.*?\]);/);
                        if (match) {
                            const rawEps = JSON.parse(match[1]);
                            episodes = rawEps.map(e => ({
                                number: e[0],
                                url: `https://www3.animeflv.net/ver/${id}-${e[0]}`
                            }));
                        }
                    } catch (err) { console.error(err); }
                }
            });

            if (!title) return null;

            return {
                title,
                synopsis,
                status,
                type,
                image_url: optimizeImageUrl(cover),
                episodes
            };
        }, 3600);

        if (!data) return res.status(404).json({ error: 'Anime no encontrado' });
        res.json(data);
    } catch (error) {
        console.error(`Error anime info ${id}:`, error.message);
        res.status(404).json({ error: 'Anime no encontrado' });
    }
});

// 4. Agenda
app.get('/api/airing', async (req, res) => {
    try {
        const items = await getCachedData('airing_schedule', async () => {
            const url = 'https://www3.animeflv.net/browse?status=1&order=default';
            const html = await cloudscraper.get(url);
            const $ = cheerio.load(html);
            const tempList = [];

            $('.ListAnimes article.Anime').each((i, el) => {
                const title = $(el).find('h3.Title').text().trim();
                const type = $(el).find('span.Type').text().trim();
                const imgSrc = $(el).find('.Image img').attr('src') || '';
                const link = $(el).find('a').attr('href');
                const slug = link ? link.split('/').pop() : '';

                let image_url = imgSrc;
                if (imgSrc && !imgSrc.startsWith('http')) {
                    image_url = 'https://www3.animeflv.net' + imgSrc;
                }

                tempList.push({
                    title,
                    type,
                    image_url: optimizeImageUrl(image_url),
                    slug,
                    episode: null
                });
            });
            return tempList;
        }, 3600);
        res.json(items);
    } catch (error) { res.status(500).json([]); }
});

// 5. SERVIDORES DE VIDEO (CORREGIDO: code -> url)
app.get('/api/episode/:slug', async (req, res) => {
    const { slug } = req.params;
    const cacheKey = `ep_${slug}`;

    try {
        const data = await getCachedData(cacheKey, async () => {
            const url = `https://www3.animeflv.net/ver/${slug}`;
            const html = await cloudscraper.get(url);
            const $ = cheerio.load(html);

            const title = $('.CapiTop .Title').text().trim() || slug;
            let servers = [];

            // Función auxiliar para normalizar servidores
            const processServers = (list) => {
                return list.map(s => ({
                    server: s.server,
                    title: s.title,
                    // CORRECCIÓN CLAVE: Usamos 'code' si 'url' no existe
                    url: s.code || s.url
                }));
            };

            $('script').each((i, el) => {
                const content = $(el).html();
                if (content && content.includes('var videos =')) {
                    try {
                        const match = content.match(/var videos = (\{.*?\});/);
                        if (match) {
                            const json = JSON.parse(match[1]);
                            if (json.SUB) servers = servers.concat(processServers(json.SUB));
                            if (json.LAT) servers = servers.concat(processServers(json.LAT));
                        }
                    } catch (e) { console.error('Error JSON videos:', e); }
                }
            });

            return { title, servers };
        }, 86400);

        res.json(data);
    } catch (error) {
        console.error('Error episode scrape:', error);
        res.status(404).json({ error: 'Episode not found' });
    }
});

// Fallback SPA
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'templates/index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});