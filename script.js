// =============================================
// 1. CATEGORY CONFIGURATION
// =============================================
const categoryConfig = {
    'crime': { 
        key: 'crime', 
        color: '#b71c1c', 
        icon: 'fa-gavel', 
        label: 'Crime',
        labelIt: 'Criminalità'
    },
    'justice': { 
        key: 'justice', 
        color: '#4a148c', 
        icon: 'fa-balance-scale', 
        label: 'Justice & Public Order',
        labelIt: 'Giustizia e ordine'
    },
    'accidents': { 
        key: 'accidents', 
        color: '#bf360c', 
        icon: 'fa-car-crash', 
        label: 'Accidents & Emergencies',
        labelIt: 'Incidenti ed emergenze'
    },
    'weather': { 
        key: 'weather', 
        color: '#f57f17', 
        icon: 'fa-cloud-rain', 
        label: 'Weather Alerts',
        labelIt: 'Disastri e allerta meteo'
    },
    'health': { 
        key: 'health', 
        color: '#1b5e20', 
        icon: 'fa-heartbeat', 
        label: 'Health',
        labelIt: 'Sanità e salute'
    },
    'society': { 
        key: 'society', 
        color: '#01579b', 
        icon: 'fa-users', 
        label: 'Society & Daily Life',
        labelIt: 'Società e vita quotidiana'
    },
    'sport': { 
        key: 'sport', 
        color: '#4e342e', 
        icon: 'fa-futbol', 
        label: 'Sport',
        labelIt: 'Sport'
    },
    'culture': { 
        key: 'culture', 
        color: '#880e4f', 
        icon: 'fa-music', 
        label: 'Culture & Entertainment',
        labelIt: 'Cultura e spettacolo'
    }
};

let events = [];

async function loadEvents() {
    try {
        const response = await fetch('data/events.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        // Supporta sia {events: [...]} che [...]
        events = data.events || data;

        console.log(events);

        return events;
    } catch (error) {
        console.error('Errore nel caricamento degli eventi:', error);
        events = getFallbackEvents();
        return events;
    }
}

// Fallback in caso di errore
function getFallbackEvents() {
    return [
        // Inserisci qui alcuni eventi di esempio
        {
            category: "crime",
            place: "Via Giuseppe Coppola, Modena",
            coordinates: { lat: 44.651368, lng: 10.895358 },
            date: "2026-01-12",
            key_info: {
                description: "Apartment burglary reported by residents",
                estimated_value: "€3,000",
            }
        }
    ];
}

// =============================================
// 3. APP STATE
// =============================================
let currentMarkers = [];
let selectedArea = null;
let map = null;
let drawnItems = null;

// =============================================
// 4. MAP INITIALISATION
// =============================================
function initMap() {
    // Verifica che Leaflet-Geoman sia caricato
    if (!checkLeafletDraw()) {
        console.warn('Problema con Leaflet-Geoman - verifica l\'ordine di caricamento');
    }

    map = L.map('map').setView([42, 12], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    drawnItems = L.featureGroup().addTo(map);

    // Geoman: qualunque forma disegnata finisce dentro drawnItems invece che
    // direttamente sulla mappa
    map.pm.setGlobalOptions({ layerGroup: drawnItems });

    // Mostra solo il pulsante rettangolo + modifica/elimina
    map.pm.addControls({
        position: 'topleft',
        drawMarker: false,
        drawCircleMarker: false,
        drawPolyline: false,
        drawRectangle: true,
        drawPolygon: false,
        drawCircle: false,
        drawText: false,
        editMode: true,
        dragMode: false,
        cutPolygon: false,
        removalMode: true,
        rotateMode: false
    });

    // Stile del rettangolo disegnato
    map.pm.setPathOptions({
        color: '#ff5a36',
        weight: 2,
        opacity: 0.8,
        fillColor: '#ff5a36',
        fillOpacity: 0.12,
        dashArray: '6, 6'
    });

    function updateAreaFromBounds(bounds, messageKey) {
        selectedArea = { bounds: bounds };

        document.getElementById('mapInfo').classList.add('show');
        const t = translations[currentLanguage] || translations['en'];
        setMapInfoText(t[messageKey]
            .replace('{north}', bounds.getNorth().toFixed(4))
            .replace('{south}', bounds.getSouth().toFixed(4)));
        setMapInfoClearVisible(true);

        applyFilters();
    }

    // Gestione CREATED
    map.on('pm:create', function(event) {
        const layer = event.layer;

        // Mantieni un solo rettangolo alla volta
        drawnItems.eachLayer(function(existing) {
            if (existing !== layer) {
                drawnItems.removeLayer(existing);
            }
        });

        map.pm.disableDraw('Rectangle');

        updateAreaFromBounds(layer.getBounds(), 'mapInfoAreaSelected');


        layer.on('pm:update', function(e) {
            // e.layer è il rettangolo modificato
            if (drawnItems.getLayers().length > 0) {
                const bounds = e.layer.getBounds();
                // Aggiorna il filtro con i nuovi bounds
                updateAreaFromBounds(bounds, 'mapInfoAreaModified');
            }
        });

        // Gestione DELETED
        layer.on('pm:remove', function() {
            selectedArea = null;
            document.getElementById('mapInfo').classList.remove('show');
            const t = translations[currentLanguage] || translations['en'];
            setMapInfoText(t.mapInfoDrawPrompt);
            setMapInfoClearVisible(false);

            applyFilters();
        });
    });

    map.on('pm:edit', function(e) {
        if (drawnItems.getLayers().length > 0) {
            const layer = drawnItems.getLayers()[0];
            updateAreaFromBounds(layer.getBounds(), 'mapInfoAreaModified');
        }
    });

    map.on('pm:update', function(e) {
        if (drawnItems.getLayers().length > 0) {
            const layer = drawnItems.getLayers()[0];
            updateAreaFromBounds(layer.getBounds(), 'mapInfoAreaModified');
        }
    });
}

// =============================================
// 4.5 VERIFICA CARICAMENTO LEAFLEFT DRAW
// =============================================
function setMapInfoText(text) {
    const el = document.getElementById('mapInfoText');
    if (el) el.innerHTML = text;
}

function setMapInfoClearVisible(visible) {
    const btn = document.getElementById('mapInfoClear');
    if (btn) btn.style.display = visible ? 'inline-flex' : 'none';
}

function checkLeafletDraw() {
    if (typeof L.PM === 'undefined') {
        console.error('Leaflet-Geoman non è caricato correttamente!');
        return false;
    }
    console.log('Leaflet-Geoman caricato correttamente');
    return true;
}

// =============================================
// 5. MARKERS
// =============================================
function getMarkerIcon(categoryKey) {
    const config = categoryConfig[categoryKey] || categoryConfig['crime'];
    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="
            width: 36px; height: 36px; background: ${config.color};
            border: 3px solid white; border-radius: 50%;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            display: flex; align-items: center; justify-content: center;
            color: white; font-size: 16px;
        "><i class="fas ${config.icon}"></i></div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -18]
    });
}

function isEntity(obj) {
    return obj && typeof obj === 'object' && obj.name && obj.uri;
}

function renderEntity(obj) {
    return `<a href="${obj.uri}" target="_blank" rel="noopener noreferrer" class="info-entity">${obj.name}</a>`;
}

function hl(text, kw) {
    if (!kw || text == null) return text == null ? '' : String(text);
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return String(text).replace(new RegExp(`(${escaped})`, 'gi'), '<mark class="hl">$1</mark>');
}

function renderInfoObject(info, keyword) {
    if (!info) return '';
    
    return Object.entries(info)
        .filter(([key, value]) => {
            if (value === null || value === undefined) return false;
            if (typeof value === 'string' && value.trim() === '') return false;
            if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) return false;
            if (Array.isArray(value) && value.length === 0) return false;
            return true;
        })
        .map(([key, value]) => {
            const formattedKey = key
                .replace(/_/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase());
            
            let displayValue;
            if (isEntity(value)) {
                const name = keyword ? hl(value.name, keyword) : value.name;
                displayValue = `<a href="${value.uri}" target="_blank" rel="noopener noreferrer" class="info-entity">${name}</a>`;
            } else if (Array.isArray(value)) {
                displayValue = value.map(item => {
                    if (isEntity(item)) {
                        const name = keyword ? hl(item.name, keyword) : item.name;
                        return `<a href="${item.uri}" target="_blank" rel="noopener noreferrer" class="info-entity">${name}</a>`;
                    }
                    if (typeof item === 'object') return '<pre class="info-json">' + JSON.stringify(item, null, 2) + '</pre>';
                    return keyword ? hl(item, keyword) : item;
                }).join(', ');
            } else if (typeof value === 'object') {
                displayValue = '<pre class="info-json">' + JSON.stringify(value, null, 2) + '</pre>';
            } else {
                displayValue = keyword ? hl(value, keyword) : value;
            }
            
            const keyHtml = keyword ? hl(formattedKey, keyword) : formattedKey;
            
            return `
                <div class="info-row">
                    <strong class="info-key">${keyHtml}:</strong>
                    <span class="info-value">${displayValue}</span>
                </div>
            `;
        }).join('');
}

function updateMarkers(filteredEvents, keyword) {
    if (!map) {
        console.warn('Mappa non ancora inizializzata');
        return;
    }
    
    currentMarkers.forEach(m => map.removeLayer(m));
    currentMarkers = [];
    
    if (!filteredEvents || filteredEvents.length === 0) {
        document.getElementById('eventCount').textContent = '0';
        return;
    }
    
    document.getElementById('eventCount').textContent = filteredEvents.length;
    
    const t = translations[currentLanguage];

    filteredEvents.forEach(event => {
        const config = categoryConfig[event.category] || categoryConfig['crime'];
        const marker = L.marker(
            [event.coordinates.lat, event.coordinates.lng], 
            { icon: getMarkerIcon(event.category), pmIgnore: true }
        ).addTo(map);

        const categoryLabel = t.categories[event.category] || config.label;

        // Genera l'HTML per l'URL nel popup
        const urlHtml = event.url ? `
            <div style="margin-top:8px;border-top:1px solid #eee;padding-top:6px;">
                <a href="${event.url}" target="_blank" style="color:var(--accent);text-decoration:none;font-size:12px;display:inline-flex;align-items:center;gap:4px;">
                    <i class="fas fa-external-link-alt"></i> ${t.readMore || 'Read more'}
                </a>
            </div>
        ` : '';

        marker.bindPopup(`
            <div style="min-width:220px;">
                <b style="font-size:15px;color:#0d1321;">${hl(event.place, keyword)}</b><br>
                <span style="color:#666;font-size:12px;">${formatDate(event.date)}</span><br>
                <span style="display:inline-block;padding:2px 10px;border-radius:12px;background:${config.color}22;color:${config.color};font-weight:600;font-size:11px;margin-top:5px;">
                    <i class="fas ${config.icon}"></i> ${categoryLabel}
                </span>
                <div style="font-size:12.5px;color:#555;margin-top:7px;line-height:1.5;">
                    ${renderInfoObject(event.key_info, keyword)}
                    ${urlHtml}
                </div>
            </div>
        `);

        currentMarkers.push(marker);
    });

    // Aggiorna il contatore con il numero di eventi validi
    document.getElementById('eventCount').textContent = filteredEvents.length;
}

// =============================================
// 6. FILTERING
// =============================================
function updateSelectAllButton() {
    const allChecked = [...document.querySelectorAll('#categoryCheckboxes input[type="checkbox"]')].every(cb => cb.checked);
    const btn = document.querySelector('.btn-select-all');
    if (allChecked) {
        btn.classList.add('active');
    } else {
        btn.classList.remove('active');
    }
}

function selectAllCategories() {
    document.querySelectorAll('#categoryCheckboxes input[type="checkbox"]').forEach(cb => {
        cb.checked = true;
    });
    updateSelectAllButton();
}

function applyFilters() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const keyword = document.getElementById('keywordSearch').value.toLowerCase().trim();
    
    const categoryCheckboxes = document.querySelectorAll('#categoryCheckboxes input[type="checkbox"]');
    const selectedCategories = [];
    
    categoryCheckboxes.forEach(cb => {
        if (cb.checked) {
            selectedCategories.push(cb.value);
        }
    });

    let filtered = events.filter(e => {
        if (!e.coordinates || e.coordinates.lat == null || e.coordinates.lng == null) return false;
        
        if (startDate && e.date < startDate) return false;
        if (endDate && e.date > endDate) return false;
        
        if (selectedCategories.length > 0) {
            if (!selectedCategories.includes(e.category)) return false;
        }
        
        if (keyword) {
            const fixedFields = ['text', 'coordinates'];
            const searchFields = Object.entries(e)
                .filter(([key]) => !fixedFields.includes(key))
                .flatMap(([key, value]) => {
                    if (value && typeof value === 'object' && !Array.isArray(value)) {
                        return Object.values(value).map(v => String(v).toLowerCase());
                    }
                    if (Array.isArray(value)) {
                        return value.map(v => String(v).toLowerCase());
                    }
                    return [String(value).toLowerCase()];
                })
                .filter(v => v && v !== 'undefined' && v !== 'null');
            
            if (!searchFields.some(field => field.includes(keyword))) {
                return false;
            }
        }
        
        if (selectedArea && selectedArea.bounds) {
            if (!selectedArea.bounds.contains([e.coordinates.lat, e.coordinates.lng])) {
                return false;
            }
        }
        return true;
    });

    updateEventsList(filtered);
    updateMarkers(filtered, keyword);

    // Adatta la vista solo se ci sono marker e la mappa è pronta
    if (filtered.length > 0 && map) {
        try {
            const markers = filtered
                .map(e => L.marker([e.coordinates.lat, e.coordinates.lng]));
            
            if (markers.length > 0) {
                const group = L.featureGroup(markers);
                map.fitBounds(group.getBounds(), { padding: [50, 50] });
            }
        } catch (e) {
            console.warn('Impossibile adattare la vista:', e);
        }
    }
}

function updateEventsList(filteredEvents) {
    const container = document.getElementById('eventsContainer');
    const t = translations[currentLanguage];

    if (filteredEvents.length === 0) {
        container.innerHTML = `<div class="no-events">${t.noEvents}</div>`;
        return;
    }

    filteredEvents = [...filteredEvents].sort((a, b) => b.date.localeCompare(a.date));

    const keyword = (document.getElementById('keywordSearch').value || '').trim();

    container.innerHTML = filteredEvents.map(e => {
        try {
            const config = categoryConfig[e.category] || categoryConfig['crime'];
            const categoryLabel = t.categories[e.category] || config.label;
            
            const urlHtml = e.url ? `
                <div class="info-row" style="margin-top:4px;">
                    <a href="${e.url}" target="_blank" class="event-url" style="color:var(--accent);text-decoration:none;font-size:11px;display:inline-flex;align-items:center;gap:4px;">
                        <i class="fas fa-external-link-alt"></i> ${t.readMore || 'Read more'}
                    </a>
                </div>
            ` : '';
            
            return `
                <div class="event-item" onclick="zoomToEvent(${e.coordinates.lat}, ${e.coordinates.lng})" style="border-left-color:${config.color};">
                    <div class="event-title">
                        <i class="fas ${config.icon}" style="color:${config.color};width:16px;"></i>
                        ${hl(e.place, keyword)}
                    </div>
                    <div class="event-date">${formatDate(e.date)}</div>
                    <span class="event-type ${config.key}">
                        <i class="fas ${config.icon}"></i> ${categoryLabel}
                    </span>
                    <div class="event-info">
                        ${renderInfoObject(e.key_info, keyword)}
                        ${urlHtml}
                    </div>
                </div>
            `;
        } catch (err) {
            console.warn('Error rendering event card:', err, e);
            return '';
        }
    }).join('');
}

// =============================================
// 7. UTILITIES
// =============================================
function formatDate(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
}

function zoomToEvent(lat, lng) {
    map.setView([lat, lng], 16);
}

function resetFilters() {
    const today = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(today.getMonth() - 1);

    const formatDateForInput = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    document.getElementById('startDate').value = formatDateForInput(oneMonthAgo);
    document.getElementById('endDate').value = formatDateForInput(today);
    document.getElementById('keywordSearch').value = '';
    
    document.querySelectorAll('#categoryCheckboxes input[type="checkbox"]').forEach(cb => {
        cb.checked = true;
    });
    updateSelectAllButton();

    drawnItems.clearLayers();
    selectedArea = null;
    document.getElementById('mapInfo').classList.remove('show');

    applyFilters();

    if (currentMarkers.length > 0) {
        const group = L.featureGroup(currentMarkers);
        map.fitBounds(group.getBounds(), { padding: [50, 50] });
    }
}

function editSelectedArea() {
    if (drawnItems.getLayers().length > 0) {
        map.pm.enableGlobalEditMode();
    } else {
        document.getElementById('mapInfo').classList.add('show');
        setMapInfoText('⚠️ Draw a rectangle first before editing!');
        setTimeout(() => {
            setMapInfoText('Draw a rectangle on the map to filter events by area');
        }, 3000);
    }
}

function clearSelectedArea() {
    // Rimuoviamo il layer con l'API nativa di Leaflet: clearLayers() NON
    // scatena l'evento 'pm:remove' di Geoman (quello parte solo se la
    // cancellazione avviene tramite la toolbar di Geoman), quindi qui
    // gestiamo noi esplicitamente tutto lo stato in un solo passaggio.
    drawnItems.clearLayers();

    selectedArea = null;
    document.getElementById('mapInfo').classList.remove('show');
    const t = translations[currentLanguage] || translations['en'];
    setMapInfoText(t.mapInfoDrawPrompt);
    setMapInfoClearVisible(false);

    applyFilters();
}

// =============================================
// 8. STARTUP
// =============================================
window.onload = async function() {
    // 1. Prima carica gli eventi
    await loadEvents();
    
    // 2. Imposta le date (PRIMA di inizializzare la mappa)
    const today = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(today.getMonth() - 1);
    
    const formatDateForInput = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    
    document.getElementById('startDate').value = formatDateForInput(oneMonthAgo);
    document.getElementById('endDate').value = formatDateForInput(today);

    // 3. Imposta lingua dal browser
    document.getElementById('languageSelect').value = 'en';
    switchLanguage('en');

    // 4. Inizializza la mappa (ora le date sono già impostate)
    initMap();

    // 5. APPLICA I FILTRI - questo caricherà i marker sulla mappa con i filtri attivi
    applyFilters();
    updateSelectAllButton();

    // 6. Adatta la vista
    if (currentMarkers.length > 0) {
        const group = L.featureGroup(currentMarkers);
        map.fitBounds(group.getBounds(), { padding: [50, 50] });
    }

    document.getElementById('mapInfo').classList.add('show');
    setMapInfoText(translations['en'].mapInfoDefault);

};

// =============================================
// 9. MULTI-LANGUAGE SUPPORT
// =============================================
const translations = {
    'en': {
        // Brand
        brandSub: 'Event Monitoring System',
        
        // Filters
        dateRange: 'Date range',
        eventCategory: 'Event category',
        allCategories: 'All categories',
        applyFilters: 'Apply filters',
        reset: 'Reset',
        sources: 'Sources',
        keywordSearch: 'Keyword search',
        searchPlaceholder: 'Search events...',
        
        // Events list
        eventsFound: 'Events found',
        noEvents: 'No events found',
        
        // Map info
        mapInfoDefault: 'Use the rectangle tool (top-left of the map) to draw an area and filter events',
        mapInfoAreaSelected: 'Area selected: {north}°N, {south}°S — click on delete to remove',
        mapInfoAreaModified: 'Area modified: {north}°N, {south}°S — click on delete to remove',
        mapInfoDrawFirst: '⚠️ Draw a rectangle first before editing!',
        mapInfoDrawPrompt: 'Draw a rectangle on the map to filter events by area',

        readMore: 'Read more',

        // Legend
        legend: 'Legend',
        
        // Category labels
        categories: {
            'crime': 'Crime',
            'justice': 'Justice & Public Order',
            'accidents': 'Accidents & Emergencies',
            'weather': 'Weather Alerts',  // ← Aggiungi questo
            'health': 'Health',
            'society': 'Society & Daily Life',
            'sport': 'Sport',
            'culture': 'Culture & Entertainment'
        },

        checkboxCategories: {
            'all': 'All',
            'crime': 'Crime',
            'justice': 'Justice',
            'accidents': 'Accidents',
            'weather': 'Weather',  // ← Aggiungi questo
            'health': 'Health',
            'society': 'Society',
            'sport': 'Sport',
            'culture': 'Culture'
        }
    },
    'it': {
        // Brand
        brandSub: 'Sistema di Monitoraggio Eventi',
        
        // Filters
        dateRange: 'Intervallo date',
        eventCategory: 'Categoria evento',
        allCategories: 'Tutte le categorie',
        applyFilters: 'Applica filtri',
        reset: 'Reimposta',
        sources: 'Fonti',
        keywordSearch: 'Ricerca per parola chiave',
        searchPlaceholder: 'Cerca eventi...',
        
        // Events list
        eventsFound: 'Eventi trovati',
        noEvents: 'Nessun evento trovato',
        
        // Map info
        mapInfoDefault: 'Usa lo strumento rettangolo (in alto a sinistra) per disegnare un\'area e filtrare gli eventi',
        mapInfoAreaSelected: 'Area selezionata: {north}°N, {south}°S — clicca su elimina per rimuovere',
        mapInfoAreaModified: 'Area modificata: {north}°N, {south}°S — clicca su elimina per rimuovere',
        mapInfoDrawFirst: '⚠️ Disegna prima un rettangolo!',
        mapInfoDrawPrompt: 'Disegna un rettangolo sulla mappa per filtrare gli eventi per area',


        readMore: 'Leggi articolo',

        // Legend
        legend: 'Legenda',
        
        // Category labels
        categories: {
            'crime': 'Criminalità',
            'justice': 'Giustizia e ordine pubblico',
            'accidents': 'Incidenti ed emergenze',
            'weather': 'Allerta meteo',
            'health': 'Sanità e salute',
            'society': 'Società e vita quotidiana',
            'sport': 'Sport',
            'culture': 'Cultura e spettacolo'
        },
        checkboxCategories: {
            'all': 'Tutte',
            'crime': 'Criminalità',
            'justice': 'Giustizia',
            'accidents': 'Incidenti',
            'weather': 'Meteo',  // ← Aggiungi questo
            'health': 'Sanità',
            'society': 'Società',
            'sport': 'Sport',
            'culture': 'Cultura'
        }
    }
};

function updateUITexts(lang) {
    const t = translations[lang];
    if (!t) return;
    
    // Mappa degli elementi da aggiornare
    const updates = [
        { selector: '.brand-sub', property: 'textContent', value: t.brandSub },
        { selector: '.btn-apply', property: 'innerHTML', value: `<i class="fas fa-magnifying-glass"></i> ${t.applyFilters}` },
        { selector: '.btn-reset', property: 'innerHTML', value: `<i class="fas fa-rotate-left"></i> ${t.reset}` },
        { selector: '.btn-sources', property: 'innerHTML', value: `<i class="fas fa-newspaper"></i> ${t.sources}` }
    ];
    
    updates.forEach(({ selector, property, value }) => {
        const el = document.querySelector(selector);
        if (el) el[property] = value;
    });
    
    // Label dei filtri
    const dateLabel = document.querySelector('.filter-section label i.fa-calendar-day')?.parentElement;
    if (dateLabel) dateLabel.innerHTML = `<i class="fas fa-calendar-day"></i> ${t.dateRange}`;
    
    const catLabel = document.querySelector('.filter-section label i.fa-tag')?.parentElement;
    if (catLabel) catLabel.innerHTML = `<i class="fas fa-tag"></i> ${t.eventCategory}`;

    const searchLabel = document.querySelector('.filter-section label i.fa-search')?.parentElement;
    if (searchLabel) searchLabel.innerHTML = `<i class="fas fa-search"></i> ${t.keywordSearch}`;

    const searchInput = document.getElementById('keywordSearch');
    if (searchInput) searchInput.placeholder = t.searchPlaceholder;
    
    // Aggiorna le checkbox delle categorie
    document.querySelectorAll('#categoryCheckboxes .category-option').forEach(label => {
        const checkbox = label.querySelector('input[type="checkbox"]');
        if (checkbox) {
            const value = checkbox.value;
            const categoryName = t.checkboxCategories?.[value] || t.categories?.[value] || value;
            const labelSpan = label.querySelector('.category-label');
            if (labelSpan) {
                labelSpan.textContent = categoryName;
            }
        }
    });
    
    // Events list header
    const eventsHeader = document.querySelector('.events-list h3');
    if (eventsHeader) {
        const count = document.getElementById('eventCount')?.textContent || '0';
        eventsHeader.innerHTML = `${t.eventsFound} <span class="count" id="eventCount">${count}</span>`;
    }
    
    // Map info
    const mapInfo = document.getElementById('mapInfo');
    if (mapInfo) {
        if (!selectedArea) {
            setMapInfoText(t.mapInfoDefault);
        } else if (selectedArea.bounds) {
            const bounds = selectedArea.bounds;
            setMapInfoText(t.mapInfoAreaSelected
                .replace('{north}', bounds.getNorth().toFixed(4))
                .replace('{south}', bounds.getSouth().toFixed(4)));
        }
    }
    
    document.title = `EventAtlas — ${t.brandSub}`;
}

function updateLegend(lang) {
    const t = translations[lang];
    if (!t) return;
    
    const legend = document.getElementById('legend');
    if (!legend) return;
    
    // Titolo legenda
    const title = legend.querySelector('h4');
    if (title) title.innerHTML = `<i class="fas fa-tag"></i> ${t.legend}`;
    
    // Categorie - usa 'weather' invece di 'disasters'
    const keys = ['crime', 'justice', 'accidents', 'weather', 'health', 'society', 'sport', 'culture'];
    const items = legend.querySelectorAll('.legend-item');
    
    items.forEach((item, i) => {
        if (i < keys.length) {
            const text = item.querySelector('.legend-text');
            if (text && t.categories[keys[i]]) {
                text.textContent = t.categories[keys[i]];
            }
        }
    });
}



let currentLanguage = 'en';

function switchLanguage(lang) {
    currentLanguage = lang;
    
    // Aggiorna la select
    document.getElementById('languageSelect').value = lang;
    
    // Aggiorna i testi della UI
    updateUITexts(lang);
    
    // Aggiorna la legenda
    updateLegend(lang);
    
    // Aggiorna la lista eventi (per le categorie nella lista)
    applyFilters();
}