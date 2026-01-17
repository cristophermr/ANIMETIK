const cloudscraper = require('cloudscraper');
const cheerio = require('cheerio');

async function getServers(episodeSlug) {
    const url = `https://www3.animeflv.net/ver/${episodeSlug}`;
    console.log(`Scraping URL: ${url}`);

    try {
        const html = await cloudscraper.get(url);
        console.log('HTML Length:', html.length);
        console.log('Preview:', html.substring(0, 500));
        const $ = cheerio.load(html);

        // AnimeFLV suele guardar los videos en una variable scripts
        // var videos = {"SUB":[...]}
        const scripts = $('script');
        let videoData = null;

        scripts.each((i, el) => {
            const content = $(el).html();
            if (content && content.includes('var videos =')) {
                // Extraer el JSON
                try {
                    const jsonStr = content.split('var videos =')[1].split(';')[0];
                    videoData = JSON.parse(jsonStr);
                    return false; // break
                } catch (e) {
                    console.error('Error parsing JSON:', e.message);
                }
            }
        });

        return videoData;
    } catch (e) {
        console.error('Error scraping:', e.message);
        return null;
    }
}

(async () => {
    // Probamos con un episodio reciente o conocido
    const slug = 'one-piece-1070'; // Ejemplo
    const servers = await getServers(slug);

    if (servers) {
        console.log('--- Servidores Encontrados ---');
        console.log(JSON.stringify(servers, null, 2));
    } else {
        console.log('No se pudieron extraer servidores.');
    }
})();
