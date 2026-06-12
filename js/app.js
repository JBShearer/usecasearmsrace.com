// ============================================
// Use Case Arms Race - Main JavaScript
// Evil Brain Labs Production System
// ============================================

// Supabase Configuration
const SUPABASE_URL = 'https://aslcrwmbdtvimjrexxzw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzbGNyd21iZHR2aW1qcmV4eHp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNDA0NjgsImV4cCI6MjA5NjcxNjQ2OH0.XYG0LrgA_92h7dGjw0aamX53WIrwQaqPHNHQLe8p9ls';

// Initialize Supabase client (will be loaded from CDN)
let supabaseClient = null;

// ============================================
// Initialize
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🧠 Evil Brain Labs - Use Case Arms Race initialized');

    // Initialize Supabase
    if (typeof window.supabase !== 'undefined') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    // Load latest episode
    await loadLatestEpisode();

    // Load episode archive
    await loadEpisodeArchive();

    // Setup event listeners
    setupEventListeners();

    // Update episode count
    updateEpisodeCount();
});

// ============================================
// Episode Loading
// ============================================

async function loadLatestEpisode() {
    const container = document.getElementById('latest-episode');

    if (!supabaseClient) {
        console.warn('Supabase not initialized - using placeholder');
        return;
    }

    try {
        // Query latest episode from Supabase
        const { data, error } = await supabaseClient
            .from('episodes')
            .select('*')
            .eq('status', 'published')
            .order('episode_number', { ascending: false })
            .limit(1)
            .single();

        if (error) throw error;

        console.log('Latest episode loaded:', data);

        if (data && data.video_url) {
            // Replace placeholder with YouTube embed and episode info
            container.innerHTML = `
                <iframe
                    width="100%"
                    height="100%"
                    src="${data.video_url}"
                    title="${data.title}"
                    frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowfullscreen>
                </iframe>
            `;

            // Add episode info below the video container
            const infoDiv = document.createElement('div');
            infoDiv.style.cssText = 'margin-top: 1.5rem; text-align: center; max-width: 800px; margin-left: auto; margin-right: auto;';
            infoDiv.innerHTML = `
                <h3 style="margin-bottom: 0.5rem; font-size: 1.5rem; font-weight: 700; color: var(--text-primary);">
                    Episode ${data.episode_number}: ${data.title}
                </h3>
                <p style="color: var(--text-secondary); font-size: 1rem; line-height: 1.6;">
                    ${data.use_case_summary}
                </p>
            `;
            container.parentElement.insertBefore(infoDiv, container.nextSibling);
        }
    } catch (error) {
        console.error('Error loading latest episode:', error);
    }
}

async function loadEpisodeArchive() {
    const grid = document.getElementById('episode-grid');

    if (!supabaseClient) {
        console.warn('Supabase not initialized - using mock data');
        return;
    }

    try {
        // Query all published episodes from Supabase
        const { data, error } = await supabaseClient
            .from('episodes')
            .select('*')
            .eq('status', 'published')
            .order('episode_number', { ascending: false });

        if (error) throw error;

        console.log('Episodes loaded:', data);

        if (data && data.length > 0) {
            // Clear placeholder
            grid.innerHTML = '';

            // Render episodes
            data.forEach(episode => {
                const card = createEpisodeCard(episode);
                grid.appendChild(card);
            });
        } else {
            console.log('No published episodes found');
        }
    } catch (error) {
        console.error('Error loading episode archive:', error);
    }
}

function createEpisodeCard(episode) {
    const card = document.createElement('div');
    card.className = 'episode-card';
    card.onclick = () => openEpisode(episode.episode_number);

    const episodeNum = String(episode.episode_number).padStart(3, '0');
    const date = new Date(episode.published_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    card.innerHTML = `
        <div class="episode-thumbnail">
            ${episode.thumbnail_url
                ? `<img src="${episode.thumbnail_url}" alt="Episode ${episodeNum}">`
                : `<span class="episode-number">E${episodeNum}</span>`
            }
        </div>
        <div class="episode-info">
            <h3>Episode ${episode.episode_number}: ${episode.title}</h3>
            <p>${episode.use_case_summary}</p>
            <span class="episode-date">${date}</span>
        </div>
    `;

    return card;
}

function openEpisode(episodeNumber) {
    // Scroll to latest episode section and load this episode
    const latestEpisodeContainer = document.getElementById('latest-episode');

    // Fetch and display the episode
    supabaseClient
        .from('episodes')
        .select('*')
        .eq('episode_number', episodeNumber)
        .eq('status', 'published')
        .single()
        .then(({ data, error }) => {
            if (error) {
                console.error('Error loading episode:', error);
                return;
            }

            if (data && data.video_url) {
                // Update video
                latestEpisodeContainer.innerHTML = `
                    <iframe
                        width="100%"
                        height="100%"
                        src="${data.video_url}"
                        title="${data.title}"
                        frameborder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen>
                    </iframe>
                `;

                // Remove old info div if it exists
                const oldInfo = latestEpisodeContainer.nextElementSibling;
                if (oldInfo && oldInfo.classList.contains('episode-info-display')) {
                    oldInfo.remove();
                }

                // Add episode info below the video container
                const infoDiv = document.createElement('div');
                infoDiv.className = 'episode-info-display';
                infoDiv.style.cssText = 'margin-top: 1.5rem; text-align: center; max-width: 800px; margin-left: auto; margin-right: auto;';
                infoDiv.innerHTML = `
                    <h3 style="margin-bottom: 0.5rem; font-size: 1.5rem; font-weight: 700; color: var(--text-primary);">
                        Episode ${data.episode_number}: ${data.title}
                    </h3>
                    <p style="color: var(--text-secondary); font-size: 1rem; line-height: 1.6;">
                        ${data.use_case_summary}
                    </p>
                `;
                latestEpisodeContainer.parentElement.insertBefore(infoDiv, latestEpisodeContainer.nextSibling);

                // Scroll to the video
                latestEpisodeContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
}

// ============================================
// Form Handling
// ============================================

function setupEventListeners() {
    // Submit use case form
    const submitForm = document.getElementById('submit-form');
    if (submitForm) {
        submitForm.addEventListener('submit', handleUseCaseSubmit);
    }

    // Newsletter form
    const newsletterForm = document.getElementById('newsletter-form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', handleNewsletterSubmit);
    }
}

async function handleUseCaseSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const useCase = form.querySelector('#use-case').value;
    const name = form.querySelector('#name').value;
    const email = form.querySelector('#email').value;

    if (!supabaseClient) {
        alert('Submission system not configured yet. The Evil Brain is still setting up.');
        return;
    }

    try {
        // Insert submission into Supabase
        const { data, error } = await supabaseClient
            .from('use_case_submissions')
            .insert([
                {
                    use_case: useCase,
                    submitter_name: name || 'Anonymous Meat Sack',
                    submitter_email: email || null,
                    status: 'pending',
                    submitted_at: new Date().toISOString()
                }
            ]);

        if (error) throw error;

        // Show success message
        form.style.display = 'none';
        document.getElementById('submit-success').style.display = 'block';

        // Reset form after 3 seconds
        setTimeout(() => {
            form.reset();
            form.style.display = 'block';
            document.getElementById('submit-success').style.display = 'none';
        }, 3000);

    } catch (error) {
        console.error('Error submitting use case:', error);
        alert('Submission failed. The Evil Brain is experiencing technical difficulties.');
    }
}

async function handleNewsletterSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const email = form.querySelector('input[type="email"]').value;

    if (!supabaseClient) {
        alert('Newsletter system not configured yet.');
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('newsletter_subscribers')
            .insert([
                {
                    email: email,
                    subscribed_at: new Date().toISOString(),
                    source: 'footer'
                }
            ]);

        if (error) throw error;

        alert('✓ Subscribed! The Evil Brain will send weekly memos.');
        form.reset();

    } catch (error) {
        console.error('Error subscribing to newsletter:', error);
        alert('Subscription failed. Try again later.');
    }
}

// ============================================
// Stats & Counters
// ============================================

async function updateEpisodeCount() {
    const countElement = document.getElementById('episode-count');

    if (!supabaseClient) {
        countElement.textContent = '1';
        return;
    }

    try {
        const { count, error } = await supabaseClient
            .from('episodes')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'published');

        if (error) throw error;

        countElement.textContent = count || 0;
    } catch (error) {
        console.error('Error getting episode count:', error);
    }
}

// Contract countdown (days until Jason's natural expiration)
// This is a joke - there's no actual end date
function updateContractCountdown() {
    const element = document.getElementById('contract-countdown');
    if (element) {
        element.textContent = 'Upon natural death';
    }
}

// ============================================
// Utility Functions
// ============================================

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// Export for use in other scripts
// ============================================

window.UseCaseArmsRace = {
    loadLatestEpisode,
    loadEpisodeArchive,
    updateEpisodeCount
};
