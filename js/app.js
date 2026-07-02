// ============================================
// Use Case Arms Race - Main JavaScript
// Evil Brain Labs Production System
// ============================================

// Supabase Configuration
const SUPABASE_URL = 'https://aslcrwmbdtvimjrexxzw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzbGNyd21iZHR2aW1qcmV4eHp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNDA0NjgsImV4cCI6MjA5NjcxNjQ2OH0.XYG0LrgA_92h7dGjw0aamX53WIrwQaqPHNHQLe8p9ls';

// Initialize Supabase client (will be loaded from CDN)
let supabaseClient = null;

// State for filing form
let selectedTags = [];
let selectedRelations = [];

// US States for region dropdown
const US_STATES = [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
    'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
    'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
    'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
    'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
    'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
    'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
    'Wisconsin', 'Wyoming'
];

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

    // Load case book
    await loadCases();

    // Setup event listeners
    setupEventListeners();

    // Update episode count
    updateEpisodeCount();
});

// ============================================
// Case Book Loading
// ============================================

async function loadCases(filter = {}) {
    const caseList = document.getElementById('case-list');
    if (!caseList) return;

    if (!supabaseClient) {
        caseList.innerHTML = '<p class="error">Database not connected.</p>';
        return;
    }

    caseList.innerHTML = '<p class="loading">Loading cases...</p>';

    try {
        let query = supabaseClient
            .from('use_cases')
            .select('id, title, description, category, severity, status, location_country, location_region, tags, created_at')
            .in('status', ['active', 'approved'])
            .order('created_at', { ascending: false })
            .limit(50);

        // Apply filters
        if (filter.category) {
            query = query.eq('category', filter.category);
        }
        if (filter.search) {
            query = query.or(`title.ilike.%${filter.search}%,description.ilike.%${filter.search}%`);
        }

        const { data: cases, error } = await query;

        if (error) throw error;

        if (!cases || cases.length === 0) {
            caseList.innerHTML = '<p class="empty">No cases found. Be the first to file one!</p>';
            return;
        }

        caseList.innerHTML = cases.map(c => renderCaseCard(c)).join('');

    } catch (error) {
        console.error('Error loading cases:', error);
        caseList.innerHTML = '<p class="error">Failed to load cases.</p>';
    }
}

function renderCaseCard(c) {
    const severityDots = Array.from({ length: 5 }, (_, i) =>
        `<span class="severity-dot ${i < c.severity ? 'active' : ''}"></span>`
    ).join('');

    const location = c.location_country
        ? `📍 ${c.location_region || ''} ${c.location_country}`
        : '';

    const tags = (c.tags || []).slice(0, 3).map(t =>
        `<span class="tag-mini">${t}</span>`
    ).join('');

    return `
        <div class="case-card" data-id="${c.id}">
            ${c.category ? `<span class="category-badge">${c.category}</span>` : ''}
            <h3>${escapeHtml(c.title)}</h3>
            <p>${escapeHtml(c.description?.substring(0, 150))}${c.description?.length > 150 ? '...' : ''}</p>
            <div class="severity">${severityDots}</div>
            ${location ? `<div class="case-location">${location}</div>` : ''}
            ${tags ? `<div class="case-tags">${tags}</div>` : ''}
        </div>
    `;
}

// ============================================
// Filing Form
// ============================================

function toggleFilingForm() {
    const casebook = document.getElementById('casebook');
    const filingSection = document.getElementById('submit');

    if (filingSection.style.display === 'none') {
        casebook.style.display = 'none';
        filingSection.style.display = 'block';
        filingSection.scrollIntoView({ behavior: 'smooth' });
    } else {
        filingSection.style.display = 'none';
        casebook.style.display = 'block';
    }
}

function resetFilingForm() {
    const form = document.getElementById('submit-form');
    const success = document.getElementById('submit-success');

    form.reset();
    form.style.display = 'block';
    success.style.display = 'none';

    // Reset state
    selectedTags = [];
    selectedRelations = [];
    renderTags();
    renderSelectedRelations();
}

async function handleUseCaseSubmit(e) {
    e.preventDefault();

    const form = e.target;

    if (!supabaseClient) {
        alert('Submission system not configured. The Evil Brain is still setting up.');
        return;
    }

    // Gather form data
    const title = form.querySelector('#title').value;
    const description = form.querySelector('#description').value;
    const url = form.querySelector('#url').value || null;
    const company = form.querySelector('#company').value || null;
    const country = form.querySelector('#country').value || null;
    const region = form.querySelector('#region').value || null;
    const category = form.querySelector('#category').value || null;
    const severity = parseInt(form.querySelector('#severity').value) || 3;

    // Gather checkboxes
    const archComponents = Array.from(form.querySelectorAll('input[name="arch"]:checked'))
        .map(cb => cb.value);
    const dataSources = Array.from(form.querySelectorAll('input[name="datasrc"]:checked'))
        .map(cb => cb.value);

    // Get current user (if logged in)
    const { data: { user } } = await supabaseClient.auth.getUser();

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    try {
        // Insert the use case with pending_review status
        const { data: newCase, error } = await supabaseClient
            .from('use_cases')
            .insert([{
                title,
                description,
                url_raw: url,
                url_display: null,  // Hidden until approved
                url_approved: false,
                company_name_raw: company,
                company_name_display: null,  // Hidden until approved
                company_approved: false,
                location_country: country,
                location_region: region,
                category,
                severity,
                tags: selectedTags,
                architecture_components: archComponents,
                data_sources: dataSources,
                status: 'pending_review',
                submitted_by: user?.id || null
            }])
            .select()
            .single();

        if (error) throw error;

        // Insert case relationships if any
        if (selectedRelations.length > 0 && newCase) {
            const relationships = selectedRelations.map(rel => ({
                source_case_id: newCase.id,
                target_case_id: rel.caseId,
                relationship_type: rel.type,
                created_by: user?.id || null
            }));

            await supabaseClient
                .from('case_relationships')
                .insert(relationships);
        }

        // Show success
        form.style.display = 'none';
        document.getElementById('submit-success').style.display = 'block';

    } catch (error) {
        console.error('Error submitting case:', error);
        alert('Submission failed: ' + (error.message || 'Unknown error'));
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '🧠 Submit Case →';
    }
}

// ============================================
// Tag Input
// ============================================

function setupTagInput() {
    const tagInput = document.getElementById('tag-input');
    if (!tagInput) return;

    tagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const tag = tagInput.value.trim().toLowerCase().replace(/\s+/g, '-');
            if (tag && !selectedTags.includes(tag)) {
                selectedTags.push(tag);
                renderTags();
            }
            tagInput.value = '';
        }
    });
}

function renderTags() {
    const container = document.getElementById('tag-chips');
    if (!container) return;

    container.innerHTML = selectedTags.map((tag, i) => `
        <span class="tag-chip">
            ${escapeHtml(tag)}
            <span class="remove-tag" onclick="removeTag(${i})">×</span>
        </span>
    `).join('');
}

function removeTag(index) {
    selectedTags.splice(index, 1);
    renderTags();
}

// ============================================
// Related Cases Typeahead
// ============================================

function setupRelatedCasesSearch() {
    const searchInput = document.getElementById('related-search');
    const resultsContainer = document.getElementById('related-results');
    if (!searchInput || !resultsContainer) return;

    let debounceTimer;

    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => searchRelatedCases(searchInput.value), 300);
    });

    searchInput.addEventListener('focus', () => {
        if (searchInput.value.length >= 2) {
            resultsContainer.style.display = 'block';
        }
    });

    // Hide results when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.form-group')) {
            resultsContainer.style.display = 'none';
        }
    });
}

async function searchRelatedCases(query) {
    const resultsContainer = document.getElementById('related-results');
    if (!resultsContainer || query.length < 2) {
        resultsContainer.style.display = 'none';
        return;
    }

    if (!supabaseClient) return;

    try {
        const { data: cases, error } = await supabaseClient
            .from('use_cases')
            .select('id, title, category')
            .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
            .in('status', ['active', 'approved'])
            .limit(5);

        if (error) throw error;

        if (!cases || cases.length === 0) {
            resultsContainer.innerHTML = '<div class="result-item">No cases found</div>';
        } else {
            resultsContainer.innerHTML = cases.map(c => `
                <div class="result-item" onclick="selectRelatedCase('${c.id}', '${escapeHtml(c.title)}')">
                    <strong>${escapeHtml(c.title)}</strong>
                    ${c.category ? `<span class="category-mini">${c.category}</span>` : ''}
                </div>
            `).join('');
        }

        resultsContainer.style.display = 'block';

    } catch (error) {
        console.error('Error searching cases:', error);
    }
}

function selectRelatedCase(caseId, title) {
    // Don't add duplicates
    if (selectedRelations.find(r => r.caseId === caseId)) return;

    selectedRelations.push({
        caseId,
        title,
        type: 'same_mistake_as'
    });

    renderSelectedRelations();

    // Clear search
    document.getElementById('related-search').value = '';
    document.getElementById('related-results').style.display = 'none';
}

function renderSelectedRelations() {
    const container = document.getElementById('selected-relations');
    if (!container) return;

    container.innerHTML = selectedRelations.map((rel, i) => `
        <div class="relation-item">
            <span>${escapeHtml(rel.title)}</span>
            <select onchange="updateRelationType(${i}, this.value)">
                <option value="same_mistake_as" ${rel.type === 'same_mistake_as' ? 'selected' : ''}>same_mistake_as</option>
                <option value="enables" ${rel.type === 'enables' ? 'selected' : ''}>enables</option>
                <option value="worse_version_of" ${rel.type === 'worse_version_of' ? 'selected' : ''}>worse_version_of</option>
                <option value="variant_of" ${rel.type === 'variant_of' ? 'selected' : ''}>variant_of</option>
                <option value="requires" ${rel.type === 'requires' ? 'selected' : ''}>requires</option>
            </select>
            <span class="remove-relation" onclick="removeRelation(${i})">×</span>
        </div>
    `).join('');
}

function updateRelationType(index, type) {
    selectedRelations[index].type = type;
}

function removeRelation(index) {
    selectedRelations.splice(index, 1);
    renderSelectedRelations();
}

// ============================================
// Country/Region Dropdown
// ============================================

function setupCountryRegion() {
    const countrySelect = document.getElementById('country');
    const regionSelect = document.getElementById('region');
    if (!countrySelect || !regionSelect) return;

    countrySelect.addEventListener('change', () => {
        const country = countrySelect.value;
        regionSelect.innerHTML = '<option value="">Select region...</option>';
        regionSelect.disabled = !country;

        if (country === 'US') {
            US_STATES.forEach(state => {
                const opt = document.createElement('option');
                opt.value = state;
                opt.textContent = state;
                regionSelect.appendChild(opt);
            });
        }
        // Add more country-specific regions as needed
    });
}

// ============================================
// Character Count
// ============================================

function setupCharCount() {
    const desc = document.getElementById('description');
    const counter = document.getElementById('desc-count');
    if (!desc || !counter) return;

    desc.addEventListener('input', () => {
        counter.textContent = desc.value.length;
    });
}

// ============================================
// AI Classification (auto-suggest tags)
// ============================================

let classifyDebounceTimer;
let lastClassifiedText = '';

function setupClassification() {
    const desc = document.getElementById('description');
    if (!desc) return;

    desc.addEventListener('blur', async () => {
        const text = desc.value.trim();
        if (text.length < 50 || text === lastClassifiedText) return;

        lastClassifiedText = text;
        await classifyDescription(text);
    });
}

async function classifyDescription(description) {
    const suggestionsContainer = document.getElementById('ai-suggestions');

    // Create suggestions container if it doesn't exist
    if (!suggestionsContainer) {
        const desc = document.getElementById('description');
        if (!desc) return;

        const container = document.createElement('div');
        container.id = 'ai-suggestions';
        container.className = 'ai-suggestions';
        container.innerHTML = '<div class="suggestions-loading">🧠 Analyzing...</div>';
        desc.parentNode.appendChild(container);
    } else {
        suggestionsContainer.innerHTML = '<div class="suggestions-loading">🧠 Analyzing...</div>';
        suggestionsContainer.style.display = 'block';
    }

    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/classify_case`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ description })
        });

        if (!response.ok) throw new Error('Classification failed');

        const result = await response.json();
        displaySuggestions(result);

    } catch (error) {
        console.error('Classification error:', error);
        const container = document.getElementById('ai-suggestions');
        if (container) container.style.display = 'none';
    }
}

function displaySuggestions(result) {
    const container = document.getElementById('ai-suggestions');
    if (!container) return;

    const { issues, ai_tech, data_sources } = result;

    if (!issues?.length && !ai_tech?.length && !data_sources?.length) {
        container.style.display = 'none';
        return;
    }

    let html = '<div class="suggestions-header">🧠 Suggested classifications (click to apply):</div>';

    if (issues?.length) {
        html += '<div class="suggestion-group"><span class="group-label">Issues:</span>';
        html += issues.map(i => `
            <span class="suggestion-chip ${i.confidence}" onclick="applySuggestion('category', '${i.tag}')">
                ${formatTag(i.tag)}
            </span>
        `).join('');
        html += '</div>';
    }

    if (ai_tech?.length) {
        html += '<div class="suggestion-group"><span class="group-label">AI Tech:</span>';
        html += ai_tech.map(t => `
            <span class="suggestion-chip ${t.confidence}" onclick="applySuggestion('arch', '${t.tag}')">
                ${formatTag(t.tag)}
            </span>
        `).join('');
        html += '</div>';
    }

    if (data_sources?.length) {
        html += '<div class="suggestion-group"><span class="group-label">Data:</span>';
        html += data_sources.map(d => `
            <span class="suggestion-chip ${d.confidence}" onclick="applySuggestion('datasrc', '${d.tag}')">
                ${formatTag(d.tag)}
            </span>
        `).join('');
        html += '</div>';
    }

    container.innerHTML = html;
    container.style.display = 'block';
}

function formatTag(tag) {
    return tag.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function applySuggestion(type, value) {
    if (type === 'category') {
        const select = document.getElementById('category');
        if (select) {
            select.value = value;
            select.dispatchEvent(new Event('change'));
        }
    } else if (type === 'arch') {
        const checkbox = document.querySelector(`input[name="arch"][value="${value}"]`);
        if (checkbox && !checkbox.checked) {
            checkbox.checked = true;
        }
    } else if (type === 'datasrc') {
        const checkbox = document.querySelector(`input[name="datasrc"][value="${value}"]`);
        if (checkbox && !checkbox.checked) {
            checkbox.checked = true;
        }
    }

    // Visual feedback - mark suggestion as applied
    event.target.classList.add('applied');
    event.target.onclick = null;
}

// ============================================
// Case Search & Filter
// ============================================

function setupCaseFilters() {
    const searchInput = document.getElementById('case-search');
    const categoryFilter = document.getElementById('case-filter-category');

    let debounceTimer;

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => applyFilters(), 300);
        });
    }

    if (categoryFilter) {
        categoryFilter.addEventListener('change', applyFilters);
    }
}

function applyFilters() {
    const search = document.getElementById('case-search')?.value || '';
    const category = document.getElementById('case-filter-category')?.value || '';

    loadCases({ search, category });
}

// ============================================
// Episode Loading (existing)
// ============================================

async function loadLatestEpisode() {
    const container = document.getElementById('latest-episode');

    if (!supabaseClient) {
        console.warn('Supabase not initialized - using placeholder');
        return;
    }

    try {
        const { data: episode, error } = await supabaseClient
            .from('episodes')
            .select('*')
            .eq('status', 'published')
            .order('episode_number', { ascending: false })
            .limit(1)
            .single();

        if (error) throw error;

        if (episode) {
            document.getElementById('current-episode-number').textContent = episode.episode_number;
            document.getElementById('current-episode-title').textContent = episode.title;
            document.getElementById('current-episode-date').textContent =
                new Date(episode.published_at).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
        }
    } catch (error) {
        console.warn('Error loading latest episode:', error);
    }
}

async function loadEpisodeArchive() {
    const grid = document.getElementById('episode-grid');

    if (!supabaseClient || !grid) {
        console.warn('Supabase not initialized or grid not found');
        return;
    }

    try {
        const { data: episodes, error } = await supabaseClient
            .from('episodes')
            .select('*')
            .eq('status', 'published')
            .order('episode_number', { ascending: false })
            .limit(12);

        if (error) throw error;

        if (episodes && episodes.length > 0) {
            grid.innerHTML = episodes.map(ep => `
                <div class="episode-card" data-episode-id="${ep.id}">
                    <div class="episode-thumbnail">
                        <span class="episode-number">#${ep.episode_number}</span>
                    </div>
                    <div class="episode-info">
                        <h3>${escapeHtml(ep.title)}</h3>
                        <p>${escapeHtml(ep.description?.substring(0, 100) || '')}...</p>
                        <span class="episode-date">${new Date(ep.published_at).toLocaleDateString()}</span>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.warn('Error loading episode archive:', error);
    }
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

    // Setup new form components
    setupTagInput();
    setupRelatedCasesSearch();
    setupCountryRegion();
    setupCharCount();
    setupCaseFilters();
    setupClassification();
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
        console.error('Error subscribing:', error);
        alert('Subscription failed. Please try again.');
    }
}

// ============================================
// Episode Count
// ============================================

async function updateEpisodeCount() {
    if (!supabaseClient) return;

    try {
        const { count, error } = await supabaseClient
            .from('episodes')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'published');

        if (!error && count !== null) {
            const el = document.getElementById('episode-count');
            if (el) el.textContent = count;
        }
    } catch (e) {
        console.warn('Failed to get episode count');
    }
}

// ============================================
// Utilities
// ============================================

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (m) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[m]);
}

// Make functions globally available for onclick handlers
window.toggleFilingForm = toggleFilingForm;
window.resetFilingForm = resetFilingForm;
window.removeTag = removeTag;
window.selectRelatedCase = selectRelatedCase;
window.updateRelationType = updateRelationType;
window.removeRelation = removeRelation;
window.applySuggestion = applySuggestion;
