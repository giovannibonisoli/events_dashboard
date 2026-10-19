const categoryConfig = {
            'crime': { color: '#b71c1c', icon: 'fa-gavel', label: 'Crime' },
            'justice': { color: '#4a148c', icon: 'fa-balance-scale', label: 'Justice & Public Order' },
            'accidents': { color: '#bf360c', icon: 'fa-car-crash', label: 'Accidents & Emergencies' },
            'weather': { color: '#f57f17', icon: 'fa-cloud-rain', label: 'Weather Alerts' },
            'health': { color: '#1b5e20', icon: 'fa-heartbeat', label: 'Health' },
            'society': { color: '#01579b', icon: 'fa-users', label: 'Society & Daily Life' },
            'sport': { color: '#4e342e', icon: 'fa-futbol', label: 'Sport' },
            'culture': { color: '#880e4f', icon: 'fa-music', label: 'Culture & Entertainment' },
            'traffic': { color: '#ef6c00', icon: 'fa-traffic-light', label: 'Traffic' },
            'other': { color: '#546e7a', icon: 'fa-question', label: 'Other' }
        };

        // Helper to extract value from { value } schema
        function getVal(obj) {
            if (!obj) return null;
            if (typeof obj === 'object' && 'value' in obj) return obj.value;
            return obj;
        }

        // Helper to extract provenance from { value, provenance } schema
        function getProv(obj) {
            if (!obj) return null;
            if (typeof obj === 'object' && 'provenance' in obj) return obj.provenance;
            return null;
        }

        let savedFieldsCache = {};

        function getEvent() {
            try {
                const data = sessionStorage.getItem('validatingEvent');
                if (!data) return null;
                return JSON.parse(data);
            } catch (e) {
                console.error('Failed to parse event data:', e);
                return null;
            }
        }

        function formatDate(d) {
            if (!d) return '';
            if (typeof d === 'object' && d.year) {
                const y = d.year, m = String(d.month || 1).padStart(2, '0'), day = String(d.day || 1).padStart(2, '0');
                return `${day}/${m}/${y}`;
            }
            if (typeof d === 'string') {
                const [y, m, day] = d.split('-');
                return `${day}/${m}/${y}`;
            }
            return String(d);
        }

        function renderValue(val) {
            if (val === null || val === undefined || val === '') {
                return '<span class="null-value">null</span>';
            }
            if (typeof val === 'boolean') return val ? 'Yes' : 'No';
            if (typeof val === 'object' && val.day) return `${val.day}/${val.month}/${val.year}`;
            if (typeof val === 'string' && val.startsWith('http')) {
                return `<span class="url-value"><a href="${val}" target="_blank">${val}</a></span>`;
            }
            return String(val);
        }

        function renderField(name, value, savedState) {
            const isDatePart = name.match(/^(start_date|end_date)\.(day|month|year)$/);
            let displayName;
            if (isDatePart) {
                const datePrefix = isDatePart[1] === 'start_date' ? 'Start Date' : 'End Date';
                const partLabel = isDatePart[2].charAt(0).toUpperCase() + isDatePart[2].slice(1);
                displayName = datePrefix + ' › ' + partLabel;
            } else if (name.startsWith('single_places[')) {
                // Clean up display name for single_places[0].field
                displayName = name.replace(/^single_places\[\d+\]\./, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            } else if (name === 'geocoded_intersection.latitude') {
                displayName = 'Latitude';
            } else if (name === 'geocoded_intersection.longitude') {
                displayName = 'Longitude';
            } else {
                displayName = name.replace(/^key_info\./, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            }
            const isNull = value === null || value === undefined || value === '';
            const savedStatus = savedState?.status || '';
            const rawCorrection = savedState?.correction;
            const correction = rawCorrection || '';
            const savedNull = rawCorrection === '__none__' || (savedStatus === 'wrong' && rawCorrection === null);
            const isKeyInfo = name.startsWith('key_info.');
            const prefix = isKeyInfo ? '<span style="font-size:10px;color:var(--text-muted);font-weight:400;">KEY_INFO › </span>' : '';

            const hasStatus = savedStatus ? 'status-' + savedStatus : '';

            const displayValue = name === 'category'
                ? (categoryConfig[value] ? categoryConfig[value].label : value)
                : name === 'multi_event'
                    ? (value === 'single' ? 'Single event' : value === 'main_secondary' ? 'Main + secondary' : value === 'multiple' ? 'Multiple events' : value || 'null')
                    : name === 'place_type'
                        ? (value === 'single' ? 'Single place' : value === 'intersection' ? 'Intersection' : value === 'multiple' ? 'Multiple places' : value || 'null')
                        : (isDatePart && isNull) ? 'null'
                        : value;

            let correctionHtml = '';
            if (name === 'is_event') {
                correctionHtml = '';
            } else if (name === 'category') {
                const currentVal = typeof value === 'string' ? value : '';
                // "other" is not a fixed option: it is the free-text "new category" option.
                const fixedCats = Object.keys(categoryConfig).filter(k => k !== 'other');
                const catOptions = fixedCats.filter(k => k !== currentVal);
                const selectedCorrection = (savedStatus === 'wrong' && correction) ? correction : '';
                const isOther = !!selectedCorrection && !fixedCats.includes(selectedCorrection);
                const otherText = (isOther && selectedCorrection !== 'other' && selectedCorrection !== '__other__') ? selectedCorrection : '';
                correctionHtml = `
                    <div class="field-correction ${savedStatus === 'wrong' ? 'show' : ''}">
                        <div class="correction-label"><i class="fas fa-pen"></i> Corrected value</div>
                        <select class="correction-category" onchange="toggleCategoryOther(this)">
                            <option value="">— Select category —</option>
                            ${catOptions.map(k => `<option value="${k}" ${selectedCorrection === k ? 'selected' : ''}>${categoryConfig[k].label}</option>`).join('')}
                            <option value="__other__" ${isOther ? 'selected' : ''}>Other</option>
                        </select>
                        <input type="text" class="correction-category-other" placeholder="Specify custom category..." style="${isOther ? 'display:block;margin-top:6px;' : 'display:none;margin-top:6px;'}" value="${otherText.replace(/"/g, '&quot;')}">
                    </div>
                `;
            } else if (isDatePart) {
                const part = isDatePart[2];
                const attrs = part === 'year' ? 'min="1900" max="2100" style="width:100px;"' :
                              part === 'month' ? 'min="1" max="12" style="width:80px;"' :
                              'min="1" max="31" style="width:80px;"';
                const isNone = savedNull;
                const nullBox = isNull ? '' : `
                            <label style="font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:4px;cursor:pointer;">
                                <input type="checkbox" class="correction-none-check" ${isNone ? 'checked' : ''} onchange="toggleDateNone(this)"> Null
                            </label>`;
                correctionHtml = `
                    <div class="field-correction ${savedStatus === 'wrong' ? 'show' : ''}">
                        <div class="correction-label"><i class="fas fa-pen"></i> Corrected value</div>
                        <div style="display:flex;align-items:center;gap:8px;">
                            <input type="number" ${attrs} placeholder="${part}" value="${isNone ? '' : String(correction ?? value ?? '')}" class="correction-date-input">
                            ${nullBox}
                        </div>
                    </div>
                `;
} else if (name === 'osm_type' || name === 'single_places[0].osm_type') {
                const osmOptions = ['node', 'way', 'relation'];
                const selectedCorrection = (savedStatus === 'wrong' && correction) ? correction : '';
                correctionHtml = `
                    <div class="field-correction ${savedStatus === 'wrong' ? 'show' : ''}">
                        <div class="correction-label"><i class="fas fa-pen"></i> Corrected value</div>
                        <select class="correction-osm-type">
                            <option value="">— Select OSM type —</option>
                            ${osmOptions.map(k => `<option value="${k}" ${selectedCorrection === k ? 'selected' : ''}>${k}</option>`).join('')}
                        </select>
                    </div>
                `;
            } else if (name === 'osm_id' || name === 'single_places[0].osm_id') {
                const osmIdVal = (savedStatus === 'wrong' && correction) ? String(correction) : '';
                correctionHtml = `
                    <div class="field-correction ${savedStatus === 'wrong' ? 'show' : ''}">
                        <div class="correction-label"><i class="fas fa-pen"></i> Corrected value</div>
                        <input type="number" step="1" min="0" class="correction-osm-id" placeholder="OSM ID" value="${osmIdVal.replace(/"/g, '"')}">
                    </div>
                `;
            } else if (name === 'multi_event') {
                const multiOptions = [
                    { value: 'single', label: 'Single Event' },
                    { value: 'main_secondary', label: 'Main + Secondary' },
                    { value: 'multiple', label: 'Multiple Events' }
                ].filter(opt => opt.value !== (value || 'single'));
                const selectedCorrection = (savedStatus === 'wrong' && correction) ? correction : '';
                correctionHtml = `
                    <div class="field-correction ${savedStatus === 'wrong' ? 'show' : ''}" style="${savedStatus === 'wrong' ? '' : 'display:none;'}">
                        <div class="correction-label"><i class="fas fa-pen"></i> Corrected value</div>
                        <div class="multi-event-radio">
                            ${multiOptions.map(opt => `
                                <label class="multi-event-radio-option">
                                    <input type="radio" name="multi_event_radio" value="${opt.value}" ${selectedCorrection === opt.value ? 'checked' : ''} onchange="onMultiEventCorrection(this)">
                                    <span>${opt.label}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                `;
            } else if (name === 'place_type') {
                const placeOptions = ['single', 'intersection', 'multiple'];
                const selectedCorrection = (savedStatus === 'wrong' && correction) ? correction : '';
                correctionHtml = `
                    <div class="field-correction ${savedStatus === 'wrong' ? 'show' : ''}">
                        <div class="correction-label"><i class="fas fa-pen"></i> Corrected value</div>
                        <select class="correction-sp-field">
                            <option value="">— Select —</option>
                            ${placeOptions.map(opt => `<option value="${opt}" ${selectedCorrection === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                        </select>
                    </div>
                `;
            } else if (name === 'geocoded_intersection.latitude' || name === 'geocoded_intersection.longitude') {
                const numCorr = (savedStatus === 'wrong' && correction != null && correction !== '') ? String(correction) : '';
                correctionHtml = `
                    <div class="field-correction ${savedStatus === 'wrong' ? 'show' : ''}">
                        <div class="correction-label"><i class="fas fa-pen"></i> Corrected value</div>
                        <input type="number" step="0.0000001" class="correction-intersection" placeholder="${name.endsWith('latitude') ? 'Latitude' : 'Longitude'}" value="${numCorr}">
                    </div>
                `;
            } else {
                correctionHtml = `
                    <div class="field-correction ${savedStatus === 'wrong' ? 'show' : ''}">
                        <div class="correction-label"><i class="fas fa-pen"></i> Corrected value</div>
                        <input type="text" placeholder="Enter the correct value..." value="${correction.replace(/"/g, '&quot;')}">
                    </div>
                `;
            }

            return `
                <div class="validation-field ${hasStatus}" data-field="${name}">
                    <div class="field-row">
                        <div class="field-info">
                            <div class="field-name">${prefix}${displayName}</div>
                            <div class="field-value ${isNull ? 'null-value' : ''}">${renderValue(displayValue)}</div>
                        </div>
                        <div class="field-status">
                            <button type="button" class="${savedStatus === 'correct' ? 'active-correct' : ''}" data-status="correct" title="Correct" onclick="setFieldStatus(this, '${name}')">
                                <i class="fas fa-check"></i>
                            </button>
                            <button type="button" class="${savedStatus === 'wrong' ? 'active-wrong' : ''}" data-status="wrong" title="Wrong" onclick="setFieldStatus(this, '${name}')">
                                <i class="fas fa-edit"></i>
                            </button>
                        </div>
                    </div>
                    ${correctionHtml}
                </div>
            `;
        }

// Render single_places field (similar to renderField but for array items)
        const SP_PROV_FIELDS = ['specific_name_place', 'address', 'city', 'county', 'hamlet', 'urban_zone'];
        const PROV_OPTIONS = ['extracted', 'deduced'];

        function renderSPField(name, label, value, savedState, disabled, type = 'text', attrs = '', selectOptions = null, isNew = false, provenance = null) {
            const isNull = value === null || value === undefined || value === '';
            const savedStatus = savedState?.status || '';
            const rawCorrection = savedState?.correction;
            const correction = rawCorrection || '';
            const savedNull = rawCorrection === '__none__' || (savedStatus === 'wrong' && rawCorrection === null);
            const hasStatus = savedStatus ? 'status-' + savedStatus : '';
            const dis = disabled ? 'disabled' : '';

            // Validation provenance selector (only for the six free-text place fields).
            // This is independent of the provenance already present in the data,
            // so it offers all possible values.
            const leafField = name.replace(/^single_places\[\d+\]\./, '');
            const needsProv = type === 'text' && SP_PROV_FIELDS.includes(leafField);
            const savedVP = savedState?.validation_provenance || '';
            const provOptions = PROV_OPTIONS;
            const provLabel = '<div style="font-size:11px;font-weight:600;color:var(--text-muted);margin:10px 0 4px;font-family:\'IBM Plex Mono\',monospace;text-transform:uppercase;letter-spacing:.3px;">Validation provenance</div>';
            const provSelectHtml = (extraDis) => needsProv ? (
                provLabel +
                '<select class="validation-prov-select"' + extraDis + '>' +
                '<option value="">— Select —</option>' +
                provOptions.map(p => `<option value="${p}" ${savedVP === p ? 'selected' : ''}>${p}</option>`).join('') +
                '</select>'
            ) : '';

            // Always render correction div (hidden by default) so it can be shown when wrong is clicked
            let correctionHtml = '';
            if (!isNew) {
                let inputHtml = '';
                // No "Null" option when the value is already null — it would be meaningless.
                const nullBox = isNull ? '' :
                    '<label style="font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:4px;cursor:pointer;">' +
                    '<input type="checkbox" class="correction-none-check" ' + (savedNull ? 'checked' : '') + ' onchange="toggleSPDateNone(this)"> Null</label>';
                if (type === 'select' && selectOptions) {
                    const selectedCorrection = correction || '';
                    const isNone = savedNull;
                    // Radio buttons: every option except the starting value, plus a Null
                    // option (omitted when the value is already null).
                    const groupName = 'sp_radio_' + name.replace(/[^a-zA-Z0-9]+/g, '_');
                    const radioOptions = selectOptions.filter(opt => opt !== value).map(opt => ({ value: opt, label: opt }));
                    if (!isNull) radioOptions.push({ value: '__none__', label: 'Null' });
                    inputHtml = `
                        <div class="correction-sp-radio">
                            ${radioOptions.map(opt => `
                                <label class="sp-radio-option">
                                    <input type="radio" name="${groupName}" value="${opt.value}" ${isNone ? (opt.value === '__none__' ? 'checked' : '') : (selectedCorrection === opt.value ? 'checked' : '')} ${dis} onchange="updateProgress()">
                                    <span>${opt.label}</span>
                                </label>
                            `).join('')}
                        </div>
                    `;
                } else if (type === 'number') {
                    const numVal = correction || '';
                    const isNone = savedNull;
                    inputHtml = `
                        <div style="display:flex;align-items:center;gap:8px;">
                            <input type="number" class="correction-sp-field" ${attrs} value="${isNone ? '' : numVal}" ${dis} ${isNone ? 'disabled' : ''}>
                            ${nullBox}
                        </div>
                    `;
                } else {
                    const isNone = savedNull;
                    inputHtml = `
                        <div style="display:flex;align-items:center;gap:8px;">
                            <input type="text" class="correction-sp-field" value="${isNone ? '' : correction.replace(/"/g, '"')}" ${dis} ${isNone ? 'disabled' : ''}>
                            ${nullBox}
                        </div>
                    `;
                }
                correctionHtml = `
                    <div class="field-correction ${savedStatus === 'wrong' ? 'show' : ''}" style="${savedStatus === 'wrong' ? '' : 'display:none;'}">
                        <div class="correction-label"><i class="fas fa-pen"></i> Corrected value</div>
                        ${inputHtml}
                        ${provSelectHtml((dis || savedNull) ? ' disabled' : '')}
                    </div>
                `;
            }
            
            const displayValue = isNull ? 'null' : value;
            const provenanceBadge = provenance ? `<span class="provenance-badge" style="font-size:9px;padding:1px 5px;border-radius:3px;background:var(--bg-hover);color:var(--text-muted);margin-left:6px;font-family:'IBM Plex Mono',monospace;">${provenance}</span>` : '';

            // For new fields, show as editable inputs without validation buttons
            if (isNew) {
                let inputHtml = '';
                if (type === 'select' && selectOptions) {
                    inputHtml = `
                        <select class="sp-field-input" ${attrs}>
                            <option value="">— Select —</option>
                            ${selectOptions.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                        </select>
                    `;
                } else if (type === 'number') {
                    inputHtml = `<input type="number" class="sp-field-input" ${attrs} value="${value || ''}">`;
                } else {
                    inputHtml = `<input type="text" class="sp-field-input" value="${value.replace(/"/g, '"')}">`;
                }
                return `
                    <div class="validation-field" data-field="${name}" style="margin:4px 0 4px 148px;">
                        <div class="field-row">
                            <div class="field-info">
                                <div class="field-name">${label}</div>
                                <div class="field-value">
                                    <div class="new-field-wrap">
                                        ${inputHtml}
                                        <label class="new-field-none-label">
                                            <input type="checkbox" class="new-field-none-check" onchange="toggleNewFieldNone(this)"> Null
                                        </label>
                                    </div>
                                    ${provSelectHtml('')}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            return `
                <div class="validation-field ${hasStatus}" data-field="${name}" style="margin:4px 0 4px 148px;">
                    <div class="field-row">
                        <div class="field-info">
                            <div class="field-name">${label}</div>
                            <div class="field-value ${isNull ? 'null-value' : ''}">${displayValue}${provenanceBadge}</div>
                        </div>
                        <div class="field-status">
                            <button type="button" class="${savedStatus === 'correct' ? 'active-correct' : ''}" data-status="correct" title="Correct" onclick="setSPFieldStatus(this, '${name}')" ${dis}><i class="fas fa-check"></i></button>
                            <button type="button" class="${savedStatus === 'wrong' ? 'active-wrong' : ''}" data-status="wrong" title="Wrong" onclick="setSPFieldStatus(this, '${name}')" ${dis}><i class="fas fa-edit"></i></button>
                        </div>
                    </div>
                    ${correctionHtml}
                </div>
`;
        }

        function lockValidation(message) {
            window.__validationLockReason = message;
            document.querySelector('.validation-fields')?.classList.add('validation-locked');
            document.querySelectorAll('.validation-field .field-status button, .ki-row .ki-status button, .ki-row .btn-delete, .ki-add-btn, .sp-row .sp-status button, .sp-row .btn-delete, .sp-add-btn').forEach(b => {
                b.disabled = true;
            });
            // keep is_event buttons interactive so the "not event" decision can be rolled back
            document.querySelectorAll('.validation-field[data-field="is_event"] .field-status button').forEach(b => {
                b.disabled = false;
            });
            if (message === 'not_event') {
                const multiEventField = document.querySelector('.validation-field[data-field="multi_event"]');
                if (multiEventField) {
                    multiEventField.querySelectorAll('.field-status button').forEach(b => { b.disabled = true; });
                }
            }
            // Temporal expressions and location spans cannot be validated while
            // the article is not an event / has no predominant event.
            suspendNewsValidation();
            updateProgress();
        }

        function unlockValidation() {
            window.__validationLockReason = null;
            document.querySelector('.validation-fields')?.classList.remove('validation-locked');
            document.querySelectorAll('.validation-field .field-status button, .ki-row .ki-status button, .ki-row .btn-delete, .ki-add-btn, .sp-row .sp-status button, .sp-row .btn-delete, .sp-add-btn').forEach(b => {
                b.disabled = false;
            });
            resumeNewsValidation();
            updateProgress();
        }

        // Suspend/resume the News Text validation (loc spans + temporal expressions).
        function suspendNewsValidation() {
            document.querySelector('.news-text-scroll')?.classList.add('news-locked');
            document.querySelector('#newsTextAnnotator')?.classList.add('news-locked');
            document.querySelectorAll('#newsUnmatchedBox input[type="radio"]').forEach(r => { r.disabled = true; });
            document.querySelectorAll('#newsUnmatchedBox .nu-option').forEach(l => l.classList.add('nu-disabled'));
            hideNewsPopover();
        }

        function resumeNewsValidation() {
            document.querySelector('.news-text-scroll')?.classList.remove('news-locked');
            document.querySelector('#newsTextAnnotator')?.classList.remove('news-locked');
            document.querySelectorAll('#newsUnmatchedBox input[type="radio"]').forEach(r => { r.disabled = false; });
            document.querySelectorAll('#newsUnmatchedBox .nu-option').forEach(l => l.classList.remove('nu-disabled'));
        }

        function onMultiEventChange(input) {
            const box = document.getElementById('multiEventBox');
            const labels = input.closest('.radio-group').querySelectorAll('label');
            labels.forEach(l => l.classList.remove('selected'));
            input.closest('label').classList.add('selected');
            const value = input.value;
            if (value === 'multiple') {
                box.classList.add('disabled-others');
                lockValidation('multiple');
            } else {
                box.classList.remove('disabled-others');
                if (isNotEvent()) {
                    lockValidation('not_event');
                } else {
                    unlockValidation();
                }
            }
        }

        function toggleDateNone(checkbox) {
            const input = checkbox.closest('.field-correction').querySelector('.correction-date-input');
            if (input) {
                input.disabled = checkbox.checked;
                if (checkbox.checked) input.value = '';
            }
        }

        function toggleSPDateNone(checkbox) {
            const correction = checkbox.closest('.field-correction');
            const input = correction.querySelector('.correction-sp-field');
            if (input) {
                input.disabled = checkbox.checked;
                if (checkbox.checked) input.value = '';
            }
            const prov = correction.querySelector('.validation-prov-select');
            if (prov) {
                prov.disabled = checkbox.checked;
                if (checkbox.checked) prov.value = '';
            }
            updateProgress();
            updateFieldAlert(checkbox.closest('.validation-field'));
        }

        function toggleNewFieldNone(checkbox) {
            const wrap = checkbox.closest('.new-field-wrap');
            const input = wrap?.querySelector('.sp-field-input');
            if (input) {
                input.disabled = checkbox.checked;
                if (checkbox.checked) input.value = '';
            }
            updateProgress();
        }

        function toggleCategoryOther(select) {
            const otherInput = select.parentElement.querySelector('.correction-category-other');
            if (otherInput) {
                otherInput.style.display = select.value === '__other__' ? 'block' : 'none';
                if (select.value === '__other__') otherInput.focus();
            }
        }

        // Reset a correction block so no stale correction is kept when a field
        // goes back from "wrong" to "correct".
        function clearCorrectionField(container) {
            if (!container) return;
            container.querySelectorAll('.correction-none-check').forEach(c => { c.checked = false; });
            container.querySelectorAll('input[type="radio"]').forEach(r => { r.checked = false; });
            container.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]), textarea').forEach(inp => { inp.value = ''; });
            container.querySelectorAll('select').forEach(sel => { sel.selectedIndex = 0; });
            const otherInput = container.querySelector('.correction-category-other');
            if (otherInput) otherInput.style.display = 'none';
        }

        function setFieldStatus(btn, fieldName) {
            const field = btn.closest('.validation-field');
            const status = btn.dataset.status;

            field.querySelectorAll('.field-status button').forEach(b => {
                b.className = '';
            });
            btn.classList.add('active-' + status);
            field.className = 'validation-field status-' + status;

            const correction = field.querySelector('.field-correction, .correction-input');
            if (correction) {
                if (status === 'wrong') {
                    correction.style.display = 'block';
                    correction.classList.add('show');
                    const input = correction.querySelector('input, textarea, select');
                    if (input) input.focus();
                    // Add change listeners to correction inputs to update progress
                    correction.querySelectorAll('input, textarea, select').forEach(inp => {
                        inp.addEventListener('change', updateProgress);
                        inp.addEventListener('input', updateProgress);
                        inp.addEventListener('input', () => updateFieldAlert(field));
                        inp.addEventListener('change', () => updateFieldAlert(field));
                        inp.addEventListener('focus', () => updateFieldAlert(field));
                        inp.addEventListener('blur', () => setTimeout(() => updateFieldAlert(field), 0));
                    });
                    if (fieldName === 'place_type') {
                        correction.querySelectorAll('input, select').forEach(inp => {
                            inp.addEventListener('change', updateIntersectionFields);
                            inp.addEventListener('input', updateIntersectionFields);
                        });
                    }
                } else {
                    correction.style.display = 'none';
                    correction.classList.remove('show');
                    clearCorrectionField(correction);
                }
            }
            updateFieldAlert(field);

            if (fieldName === 'is_event' || fieldName === 'multi_event') {
                // Lock on the resulting value: not an event (is_event false) or a
                // several-events article with no predominant event (multiple).
                const key = currentLockKey();
                if (key) lockValidation(key); else unlockValidation();
                updateProgress();
            } else {
                if (fieldName === 'place_type') updateIntersectionFields();
                updateProgress();
            }
        }

        function onMultiEventCorrection(radio) {
            const field = radio.closest('.validation-field');
            const key = currentLockKey();
            if (key) lockValidation(key); else unlockValidation();
            updateFieldAlert(field);
            updateProgress();
        }

        function setKIStatus(btn) {
            const row = btn.closest('.ki-row');
            const status = btn.dataset.status;
            const isActive = btn.classList.contains('active-' + status);

            if (isActive) {
                // toggle off — roll back to no status
                btn.classList.remove('active-' + status);
                row.className = 'ki-row';
                row.querySelectorAll('input').forEach(inp => inp.disabled = false);
            } else {
                // clear all active states on this row
                row.querySelectorAll('.ki-status button[data-status]').forEach(b => {
                    b.className = b.classList.contains('btn-delete') ? 'btn-delete' : '';
                });
                btn.classList.add('active-' + status);
                row.className = 'ki-row status-' + status;
                const disabled = status === 'correct' || status === 'deleted';
                if (status === 'correct') {
                    // revert to original values
                    const origKey = row.dataset.origKey || '';
                    const origVal = row.dataset.origVal || '';
                    const keyInput = row.querySelector('.ki-key');
                    const valInput = row.querySelector('.ki-value');
                    if (keyInput) keyInput.value = origKey;
                    if (valInput) valInput.value = origVal;
                }
                row.querySelectorAll('input').forEach(inp => inp.disabled = disabled);
                if (status === 'wrong') {
                    row.querySelector('.ki-key')?.focus();
                }
            }
            updateProgress();
        }

        window.addKIField = function() {
            const container = document.querySelector('.validation-fields');
            const addBtn = container.querySelector('.ki-add-btn');
            const row = document.createElement('div');
            row.className = 'ki-row';
            row.dataset.kiField = 'key_info.__new_' + Date.now();
            row.dataset.added = '1';
            row.innerHTML =
                '<div style="display:flex;align-items:center;gap:8px;">' +
                '  <div class="ki-inputs">' +
                '    <input type="text" class="ki-key" placeholder="Key" style="width:160px;flex-shrink:0;font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:600;">' +
                '    <input type="text" class="ki-value" placeholder="Value" style="flex:1;">' +
                '  </div>' +
                '  <button type="button" class="btn-delete" title="Remove" onclick="this.closest(\'.ki-row\').remove();updateProgress();" style="width:32px;height:32px;border-radius:6px;border:1.5px solid var(--border);background:var(--bg);cursor:pointer;color:var(--text-muted);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fas fa-times"></i></button>' +
                '</div>';
            container.insertBefore(row, addBtn);
            row.querySelector('.ki-key').focus();
            updateProgress();
        };

        // Set status for single_places field (individual field within a place)
        function setSPFieldStatus(btn, fieldName) {
            const field = btn.closest('.validation-field');
            const status = btn.dataset.status;

            field.querySelectorAll('.field-status button').forEach(b => {
                b.className = '';
            });
            btn.classList.add('active-' + status);
            field.className = 'validation-field status-' + status;

            const correction = field.querySelector('.field-correction');
            if (correction) {
                if (status === 'wrong') {
                    correction.style.display = 'block';
                    correction.classList.add('show');
                    const input = correction.querySelector('input, textarea, select');
                    if (input) input.focus();
                    // Add change listeners to correction inputs to update progress
                    correction.querySelectorAll('input, textarea, select').forEach(inp => {
                        inp.addEventListener('change', updateProgress);
                        inp.addEventListener('input', updateProgress);
                        inp.addEventListener('input', () => updateFieldAlert(field));
                        inp.addEventListener('change', () => updateFieldAlert(field));
                        inp.addEventListener('focus', () => updateFieldAlert(field));
                        inp.addEventListener('blur', () => setTimeout(() => updateFieldAlert(field), 0));
                    });
                } else {
                    correction.style.display = 'none';
                    correction.classList.remove('show');
                    clearCorrectionField(correction);
                }
            }
            updateFieldAlert(field);
            updateProgress();
        }

        // Set status for entire single_places row (delete only)
        function setSPStatus(btn, idx) {
            const row = btn.closest('.sp-row');
            const status = btn.dataset.status;
            const isNew = row.dataset.added === '1';

            if (status === 'deleted') {
                row.querySelectorAll('.field-correction').forEach(c => {
                    c.style.display = 'none';
                    c.classList.remove('show');
                });
                row.querySelectorAll('.field-alert').forEach(a => a.remove());
                if (isNew) {
                    // New place: actually remove the row
                    row.remove();
                } else {
                    // Existing place: toggle disabled/opaque state
                    const isDisabled = row.classList.contains('sp-disabled');
                    
                    if (!isDisabled) {
                        // First click: disable and make opaque
                        row.classList.add('sp-disabled');
                        row.querySelectorAll('.validation-field').forEach(f => {
                            // Store previous validation state
                            const activeBtn = f.querySelector('.field-status button[class*="active-"]');
                            f.dataset.prevStatus = activeBtn ? activeBtn.dataset.status : '';
                            
                            // Clear validation buttons visual state
                            f.querySelectorAll('.field-status button').forEach(b => {
                                b.className = '';
                                b.disabled = true;
                            });
                            // Disable inputs
                            f.querySelectorAll('input, select, textarea').forEach(inp => {
                                inp.disabled = true;
                            });
                            // Remove status classes
                            f.className = f.className.replace(/status-\w+/, '');
                        });
                        btn.classList.add('active-deleted');
                        btn.title = 'Restore place';
                    } else {
                        // Second click: restore previous state
                        row.classList.remove('sp-disabled');
                        row.querySelectorAll('.validation-field').forEach(f => {
                            // Restore validation state
                            const prevStatus = f.dataset.prevStatus;
                            f.querySelectorAll('.field-status button').forEach(b => {
                                b.className = '';
                                b.disabled = false;
                                if (b.dataset.status === prevStatus && prevStatus) {
                                    b.classList.add('active-' + prevStatus);
                                }
                            });
                            // Re-enable inputs
                            f.querySelectorAll('input, select, textarea').forEach(inp => {
                                inp.disabled = false;
                            });
                            // Restore status class
                            if (prevStatus) {
                                f.className = f.className.replace(/status-\w+/, '') + ' status-' + prevStatus;
                            }
                        });
                        btn.classList.remove('active-deleted');
                        btn.title = 'Remove place';
                    }
                }
            }
            updateProgress();
        }

        window.addSPField = function() {
            const container = document.querySelector('.validation-fields');
            const addBtn = container.querySelector('.sp-add-btn');
            
            // Find the highest existing sp-index to determine new index
            let maxIdx = -1;
            container.querySelectorAll('.sp-row').forEach(row => {
                const idx = parseInt(row.dataset.spIndex) || 0;
                if (idx > maxIdx) maxIdx = idx;
            });
            const newIdx = maxIdx + 1;
            const placePrefix = 'single_places[' + newIdx + ']';
            
            const row = document.createElement('div');
            row.className = 'sp-row';
            row.dataset.spIndex = newIdx;
            row.dataset.added = '1';
            
            // Build fields for the new place
            const fieldsHtml = [
                renderSPField(placePrefix + '.specific_name_place', 'Specific name place', '', {}, '', 'text', '', null, true),
                renderSPField(placePrefix + '.address', 'Address', '', {}, '', 'text', '', null, true),
                renderSPField(placePrefix + '.city', 'City', '', {}, '', 'text', '', null, true),
                renderSPField(placePrefix + '.county', 'County', '', {}, '', 'text', '', null, true),
                renderSPField(placePrefix + '.hamlet', 'Hamlet', '', {}, '', 'text', '', null, true),
                renderSPField(placePrefix + '.urban_zone', 'Urban Zone', '', {}, '', 'text', '', null, true),
                renderSPField(placePrefix + '.latitude', 'Latitude', '', {}, '', 'number', 'step="0.0000001"', null, true),
                renderSPField(placePrefix + '.longitude', 'Longitude', '', {}, '', 'number', 'step="0.0000001"', null, true),
                renderSPField(placePrefix + '.osm_type', 'OSM Type', '', {}, '', 'select', '', ['node', 'way', 'relation'], true),
                renderSPField(placePrefix + '.osm_id', 'OSM ID', '', {}, '', 'number', 'step="1" min="0"', null, true)
            ].join('');
            
            row.innerHTML = 
                '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;">' +
                '  <strong style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:var(--text-muted);text-transform:uppercase;min-width:140px;">Place #' + (newIdx + 1) + '</strong>' +
                '  <div class="sp-status" style="display:flex;gap:3px;">' +
                '    <button type="button" class="btn-delete" data-status="deleted" title="Remove place" onclick="setSPStatus(this, ' + newIdx + ')"><i class="fas fa-trash"></i></button>' +
                '  </div>' +
                '</div>' +
                fieldsHtml;
            
            container.insertBefore(row, addBtn);
            row.querySelectorAll('.sp-field-input, .new-field-none-check, .validation-prov-select').forEach(inp => {
                inp.addEventListener('input', updateProgress);
                inp.addEventListener('change', updateProgress);
            });
            updateProgress();
        };

        function getDateParts(event) {
            const parts = [];
            for (const prefix of ['start_date', 'end_date']) {
                for (const part of ['day', 'month', 'year']) {
                    parts.push(prefix + '.' + part);
                }
            }
            return parts;
        }

        // Read a saved field state, supporting nested start_date/end_date and
        // geocoded_intersection objects (new format) with fallback to flat
        // "start_date.day" / "geocoded_intersection.latitude" keys (legacy format)
        function getSavedFieldState(savedFields, f) {
            if (!savedFields) return undefined;
            let dm = f.match(/^(start_date|end_date)\.(day|month|year)$/);
            if (!dm) dm = f.match(/^(geocoded_intersection)\.(latitude|longitude)$/);
            if (dm) {
                const nested = savedFields[dm[1]] && savedFields[dm[1]][dm[2]];
                if (nested) return nested;
            }
            return savedFields[f];
        }

        function getAllFieldNames(event) {
            const dateParts = getDateParts(event);
            const metaFields = [
                'is_event', 'category',
                'single_places[0].address', 'single_places[0].city', 'single_places[0].county', 'single_places[0].hamlet', 'single_places[0].urban_zone',
                'single_places[0].latitude', 'single_places[0].longitude', 'single_places[0].osm_type', 'single_places[0].osm_id'
            ];
            const keyInfoFields = Object.keys(event.key_info || {}).map(k => 'key_info.' + k);
            return [...dateParts, ...metaFields, ...keyInfoFields];
        }

        function getFieldsState() {
            const state = {};
            document.querySelectorAll('.validation-field').forEach(el => {
                const name = el.dataset.field;
                if (el.dataset.insert === '1') {
                    const input = el.querySelector('.sp-field-input');
                    const raw = input?.value?.trim() || '';
                    state[name] = { value: null, status: 'inserted', correction: raw !== '' ? Number(raw) : null };
                    return;
                }
                const activeBtn = el.querySelector('.field-status button[class*="active-"]');
                if (!activeBtn) return;
                const status = activeBtn.dataset.status;

                if (!status) return;

                let correction = null;
                if (name === 'is_event' && status === 'wrong') {
                    const event = getEvent();
                    correction = event && event.is_event === true ? 'false' : 'true';
                } else if (name === 'category' && status === 'wrong') {
                    const catSelect = el.querySelector('.correction-category');
                    if (catSelect && catSelect.value) {
                        if (catSelect.value === '__other__') {
                            const otherInput = el.querySelector('.correction-category-other');
                            correction = otherInput?.value?.trim() || 'other';
                        } else {
                            correction = catSelect.value;
                        }
                    }
                } else if (name.match(/^(start_date|end_date)\.(day|month|year)$/) && status === 'wrong') {
                    const noneCheck = el.querySelector('.correction-none-check');
                    if (noneCheck?.checked) {
                        correction = null;
                    } else {
                        const numInput = el.querySelector('.correction-date-input');
                        const val = numInput?.value?.trim();
                        correction = (val && val !== '__none__') ? val : null;
                    }
                } else if ((name === 'osm_type' || name === 'single_places[0].osm_type') && status === 'wrong') {
                    const sel = el.querySelector('.correction-osm-type');
                    const v = sel?.value?.trim();
                    correction = v || null;
                } else if ((name === 'osm_id' || name === 'single_places[0].osm_id') && status === 'wrong') {
                    const numInput = el.querySelector('.correction-osm-id');
                    const v = numInput?.value?.trim();
                    correction = v || null;
                } else if (name === 'multi_event' && status === 'wrong') {
                    const radio = el.querySelector('.multi-event-radio input:checked');
                    correction = radio ? radio.value : null;
                } else if (status === 'wrong') {
                    // Check for None checkbox for SP number fields
                    const noneCheck = el.querySelector('.correction-none-check');
                    if (noneCheck && noneCheck.checked) {
                        correction = null;
                    } else {
                        const correctionInput = el.querySelector('.field-correction input, .field-correction textarea, .correction-sp-field');
                        const val = correctionInput?.value?.trim() || '';
                        correction = (val && val !== '__none__') ? val : null;
                    }
                }

                const event = getEvent();
                let originalValue = null;
                if (event) {
                    if (name.includes('[')) {
                        const match = name.match(/^(.+?)\[(\d+)\]\.(.+)$/);
                        if (match) {
                            const [, arrName, idx, key] = match;
                            const arr = event[arrName];
                            if (arr && arr[idx]) {
                                originalValue = getVal(arr[idx][key]);
                            }
                        }
                    } else if (name.includes('.')) {
                        const [obj, key] = name.split('.');
                        if (event[obj]) {
                            originalValue = getVal(event[obj][key]);
                        }
                    } else {
                        originalValue = getVal(event[name]);
                    }
                }

                state[name] = {
                    value: originalValue,
                    status,
                    correction
                };
                const provSelect = el.querySelector('.validation-prov-select');
                if (provSelect && correction != null && provSelect.value) {
                    state[name].validation_provenance = provSelect.value;
                }
            });

            // Restructure single_places from flat keys to array
            const singlePlacesMap = {};
            Object.keys(state).forEach(key => {
                const match = key.match(/^single_places\[(\d+)\]\.(.+)$/);
                if (match) {
                    const [, idx, field] = match;
                    if (!singlePlacesMap[idx]) singlePlacesMap[idx] = {};
                    singlePlacesMap[idx][field] = state[key];
                    delete state[key];
                }
            });
            if (Object.keys(singlePlacesMap).length > 0) {
                state.single_places = Object.keys(singlePlacesMap)
                    .sort((a, b) => parseInt(a) - parseInt(b))
                    .map(idx => singlePlacesMap[idx]);
            }

            // Restructure date parts into nested objects: start_date: { day, month, year }
            ['start_date', 'end_date'].forEach(prefix => {
                const dayKey = prefix + '.day';
                const monthKey = prefix + '.month';
                const yearKey = prefix + '.year';
                if (state[dayKey] !== undefined || state[monthKey] !== undefined || state[yearKey] !== undefined) {
                    state[prefix] = {
                        day: state[dayKey] !== undefined ? state[dayKey] : null,
                        month: state[monthKey] !== undefined ? state[monthKey] : null,
                        year: state[yearKey] !== undefined ? state[yearKey] : null
                    };
                    delete state[dayKey];
                    delete state[monthKey];
                    delete state[yearKey];
                }
            });

            // Restructure geocoded_intersection into a nested object: { latitude, longitude }
            const giLatKey = 'geocoded_intersection.latitude';
            const giLngKey = 'geocoded_intersection.longitude';
            if (state[giLatKey] !== undefined || state[giLngKey] !== undefined) {
                state.geocoded_intersection = {
                    latitude: state[giLatKey] !== undefined ? state[giLatKey] : null,
                    longitude: state[giLngKey] !== undefined ? state[giLngKey] : null
                };
                delete state[giLatKey];
                delete state[giLngKey];
            }

            // Collect single_places rows (sp-row)
            document.querySelectorAll('.sp-row').forEach(row => {
                const idx = parseInt(row.dataset.spIndex) || 0;
                const isNew = row.dataset.added === '1';
                const deleted = row.classList.contains('status-deleted');
                const isDisabled = row.classList.contains('sp-disabled');
                
                if (deleted && isNew) {
                    // New place that was deleted - don't include in state (removed)
                    return;
                }
                if (deleted && !isNew) {
                    // Existing place marked as deleted -> record as "wrong"
                    // The flat keys will be restructured, so mark them with status: wrong
                    return;
                }
                if (isDisabled) {
                    // Existing place marked as disabled
                    return;
                }
                // Collect field-level data for this place
                const placeFields = {};
                row.querySelectorAll('.validation-field[data-field]').forEach(el => {
                    const fieldName = el.dataset.field;
                    const activeBtn = el.querySelector('.field-status button[class*="active-"]');
                    let status;
                    let correction = null;
                    if (!activeBtn) {
                        // Newly added place field — validate via its own input / None checkbox
                        if (!isNew) return;
                        const noneCheck = el.querySelector('.new-field-none-check');
                        const input = el.querySelector('.sp-field-input');
                        if (noneCheck && noneCheck.checked) {
                            status = 'correct';
                            correction = null;
                        } else {
                            const v = input?.value?.trim() || '';
                            status = 'correct';
                            correction = v || null;
                        }
                    } else {
                        status = activeBtn.dataset.status;
                        if (status === 'wrong') {
                            const noneCheck = el.querySelector('.correction-none-check');
                            if (noneCheck && noneCheck.checked) {
                                correction = null;
                            } else {
                                const radio = el.querySelector('.correction-sp-radio input[type="radio"]:checked');
                                if (radio) {
                                    correction = (radio.value && radio.value !== '__none__') ? radio.value : null;
                                } else {
                                    const correctionInput = el.querySelector('.correction-sp-field');
                                    const v = correctionInput?.value?.trim() || '';
                                    correction = (v && v !== '__none__') ? v : null;
                                }
                            }
                        }
                    }
                    const event = getEvent();
                    let originalValue = null;
                    if (event) {
                        if (fieldName.includes('[')) {
                            const match = fieldName.match(/^(.+?)\[(\d+)\]\.(.+)$/);
                            if (match) {
                                const [, arrName, idx, key] = match;
                                const arr = event[arrName];
                                if (arr && arr[idx]) {
                                    originalValue = getVal(arr[idx][key]);
                                }
                            }
                        }
                    }
                    // Extract just the field name without index prefix (e.g., "address" from "single_places[1].address")
                    const fieldKey = fieldName.includes('[') 
                        ? fieldName.replace(/^single_places\[\d+\]\./, '')
                        : fieldName;
                    placeFields[fieldKey] = {
                        value: originalValue,
                        status,
                        correction
                    };
                    const provSelect = el.querySelector('.validation-prov-select');
                    if (provSelect && correction != null && provSelect.value) {
                        placeFields[fieldKey].validation_provenance = provSelect.value;
                    }
                });
                if (Object.keys(placeFields).length > 0) {
                    const targetKey = isNew ? '_added_single_places' : '_single_places';
                    state[targetKey] = state[targetKey] || [];
                    state[targetKey][idx] = { fields: placeFields };
                }
            });

            // Collect key info rows
            const addedFields = [];
            const keyInfoState = {};
            document.querySelectorAll('.ki-row').forEach(row => {
                const fieldName = row.dataset.kiField || '';
                const keyInput = row.querySelector('.ki-key');
                const valInput = row.querySelector('.ki-value');
                const key = keyInput?.value?.trim() || '';
                const value = valInput?.value?.trim() || '';
                const isAdded = row.dataset.added === '1';
                if (isAdded) {
                    if (key) addedFields.push({ key, value });
                    return;
                }
                const activeBtn = row.querySelector('.ki-status button[class*="active-"]');
                const deleted = row.classList.contains('status-deleted');
                if (deleted) {
                    if (fieldName && !fieldName.includes('__new_')) {
                        keyInfoState[fieldName.replace('key_info.', '')] = { status: 'deleted', correction: null, corrected_key: null, deleted: true };
                    }
                    return;
                }
                if (!activeBtn) return;
                const status = activeBtn.dataset.status;
                if (status === 'correct') {
                    if (fieldName && !fieldName.includes('__new_')) {
                        keyInfoState[fieldName.replace('key_info.', '')] = { status: 'correct', correction: null, corrected_key: null, deleted: false };
                    } else if (fieldName && fieldName.includes('__new_')) {
                        if (key) addedFields.push({ key, value });
                    }
                } else if (status === 'wrong') {
                    if (fieldName && !fieldName.includes('__new_')) {
                        const correctedKey = key !== fieldName.replace('key_info.', '') ? key : null;
                        keyInfoState[fieldName.replace('key_info.', '')] = { status: 'wrong', correction: value || null, corrected_key: correctedKey, deleted: false };
                    } else if (fieldName && fieldName.includes('__new_')) {
                        if (key) addedFields.push({ key, value });
                    }
                }
            });
            if (Object.keys(keyInfoState).length > 0) {
                state.key_info = keyInfoState;
            }
            if (addedFields.length > 0) {
                state['_added_key_info'] = addedFields;
            }

            // Handle single_places[N].latitude + single_places[N].longitude for all indices
            for (let idx = 0; idx < 10; idx++) {
                const lat = state['single_places[' + idx + '].latitude'];
                const lng = state['single_places[' + idx + '].longitude'];
                if (lat && lng && lat.correction && lng.correction) {
                    state['single_places[' + idx + '].coordinates'] = {
                        status: 'wrong',
                        correction: { lat: parseFloat(lat.correction), lng: parseFloat(lng.correction) }
                    };
                    delete state['single_places[' + idx + '].latitude'];
                    delete state['single_places[' + idx + '].longitude'];
                } else if (lat && lat.correction) {
                    delete state['single_places[' + idx + '].latitude'];
                } else if (lng && lng.correction) {
                    delete state['single_places[' + idx + '].longitude'];
                }
            }

            // multi_event is now a validation field, handled above

            return state;
        }

        // Effective is_event value given the validator's decision: a confirmed
        // field keeps the data value, a "wrong" field flips it (see getFieldsState).
        function effectiveIsEvent() {
            const field = document.querySelector('.validation-field[data-field="is_event"]');
            if (!field) return null;
            const activeBtn = field.querySelector('.field-status button[class*="active-"]');
            if (!activeBtn) return null;
            const ev = getEvent();
            const dataVal = ev ? ev.is_event === true : false;
            return activeBtn.dataset.status === 'correct' ? dataVal : !dataVal;
        }

        // Effective multi_event value: when marked wrong it is the selected
        // correction radio, otherwise the original data value.
        function effectiveMultiEvent() {
            const field = document.querySelector('.validation-field[data-field="multi_event"]');
            if (!field) return null;
            const activeBtn = field.querySelector('.field-status button[class*="active-"]');
            if (!activeBtn) return null;
            if (activeBtn.dataset.status === 'wrong') {
                const radio = field.querySelector('.multi-event-radio input:checked');
                return radio ? radio.value : null;
            }
            const ev = getEvent();
            return ev ? (ev.multi_event || 'single') : null;
        }

        function isNotEvent() {
            return effectiveIsEvent() === false;
        }

        function isMultiMultiple() {
            return effectiveMultiEvent() === 'multiple';
        }

        function isValidationLocked() {
            return isNotEvent() || isMultiMultiple();
        }

        // The reason key used by lockValidation (null when validation is active).
        function currentLockKey() {
            if (isMultiMultiple()) return 'multiple';
            if (isNotEvent()) return 'not_event';
            return null;
        }

        function lockReason() {
            if (isMultiMultiple()) return 'Multiple events, no predominant — other validations disabled';
            if (isNotEvent()) return 'Not an event — other validations disabled';
            return 'Validation disabled';
        }

        function allFieldsValidated() {
            if (updatePlacesWarning()) return false;
            if (isValidationLocked()) return true;
            if (!newsSpansState().complete) return false;
            const fields = document.querySelectorAll('.validation-field');
            for (const el of fields) {
                if (el.closest('.sp-row')) continue;
                if (el.dataset.insert === '1') {
                    const input = el.querySelector('.sp-field-input');
                    if (!input || !input.value || String(input.value).trim() === '') return false;
                    continue;
                }
                const activeBtn = el.querySelector('.field-status button[class*="active-"]');
                if (!activeBtn) return false;
                if (!isWrongFieldComplete(el)) return false;
            }
            const kiRows = document.querySelectorAll('.ki-row:not([data-added="1"])');
            for (const row of kiRows) {
                if (row.classList.contains('status-deleted')) continue;
                const activeBtn = row.querySelector('.ki-status button[class*="active-"]');
                if (!activeBtn) return false;
            }
            const spRows = document.querySelectorAll('.sp-row');
            for (const row of spRows) {
                if (row.classList.contains('sp-disabled') || row.classList.contains('status-deleted')) continue;
                const placeFields = row.querySelectorAll('.validation-field');
                let allDone = true;
                for (const f of placeFields) {
                    if (row.dataset.added === '1') {
                        if (!isAddedFieldComplete(f)) { allDone = false; break; }
                        continue;
                    }
                    const activeBtn = f.querySelector('.field-status button[class*="active-"]');
                    if (!activeBtn) { allDone = false; break; }
                    if (!isWrongFieldComplete(f)) { allDone = false; break; }
                }
                if (!allDone) return false;
            }
            return true;
        }

        function isWrongFieldComplete(el) {
            const activeBtn = el.querySelector('.field-status button[class*="active-"]');
            if (!activeBtn || activeBtn.dataset.status !== 'wrong') return true;
            const fieldName = el.dataset.field;
            if (fieldName === 'is_event') return true;
            const correctionDiv = el.querySelector('.field-correction');
            if (!correctionDiv || correctionDiv.style.display === 'none') return false;
            if (fieldName === 'multi_event') {
                return !!correctionDiv.querySelector('.multi-event-radio input:checked');
            }
            if (fieldName === 'category') {
                const sel = correctionDiv.querySelector('.correction-category');
                if (sel && sel.value === '__other__') {
                    const other = correctionDiv.querySelector('.correction-category-other');
                    return !!(other && other.value.trim() !== '');
                }
                return !!(sel && sel.value && sel.value.trim() !== '');
            }
            const spRadios = correctionDiv.querySelector('.correction-sp-radio input[type="radio"]');
            if (spRadios) {
                return !!correctionDiv.querySelector('.correction-sp-radio input[type="radio"]:checked');
            }
            const noneCheck = correctionDiv.querySelector('.correction-none-check');
            const isNone = noneCheck && noneCheck.checked;
            const provSelect = correctionDiv.querySelector('.validation-prov-select');
            const inputs = correctionDiv.querySelectorAll('input:not(.correction-none-check), select:not(.validation-prov-select), textarea');
            const hasCorrection = Array.from(inputs).some(inp => inp.value && String(inp.value).trim() !== '');
            if (provSelect && !isNone) return hasCorrection && !!provSelect.value;
            return hasCorrection || !!isNone;
        }

        // A newly added place field is complete when its input has a value or None is checked
        function isAddedFieldComplete(el) {
            const noneCheck = el.querySelector('.new-field-none-check');
            if (noneCheck && noneCheck.checked) return true;
            const input = el.querySelector('.sp-field-input');
            const hasVal = !!(input && input.value && String(input.value).trim() !== '');
            if (!hasVal) return false;
            const provSelect = el.querySelector('.validation-prov-select');
            return provSelect ? !!provSelect.value : true;
        }

        // Show/hide an inline reminder when a field is marked wrong but left uncorrected
        function updateFieldAlert(field) {
            const activeBtn = field.querySelector('.field-status button[class*="active-"]');
            const isWrong = activeBtn && activeBtn.dataset.status === 'wrong';
            const correctionDiv = field.querySelector('.field-correction');
            const existing = field.querySelector('.field-alert');

            const shouldShow = isWrong && correctionDiv &&
                !isWrongFieldComplete(field) &&
                !correctionDiv.contains(document.activeElement);

            if (!shouldShow) {
                if (existing) existing.remove();
                return;
            }
            const hasNone = correctionDiv.querySelector('.correction-none-check');
            const hasRadios = correctionDiv.querySelector('.multi-event-radio input[type="radio"], .correction-sp-radio input[type="radio"]');
            const provSelect = correctionDiv.querySelector('.validation-prov-select');
            const corrInput = correctionDiv.querySelector('.correction-sp-field');
            const hasCorrVal = !!(corrInput && corrInput.value && corrInput.value.trim() !== '');
            const msg = hasRadios
                ? 'Please select the corrected value.'
                : (provSelect && hasCorrVal && !provSelect.value)
                    ? 'Please select the validation provenance.'
                    : hasNone
                        ? 'Please insert the correction or check "Null".'
                        : 'Please insert the correction.';
            if (!existing) {
                const alert = document.createElement('div');
                alert.className = 'field-alert';
                alert.innerHTML = '<i class="fas fa-triangle-exclamation"></i> ' + msg;
                correctionDiv.appendChild(alert);
            } else {
                existing.innerHTML = '<i class="fas fa-triangle-exclamation"></i> ' + msg;
            }
        }

        function getEffectivePlaceType() {
            const event = getEvent();
            if (!event) return 'single';
            let effective = getVal(event.place_type) || event.place_type || 'single';
            const ptField = document.querySelector('.validation-field[data-field="place_type"]');
            if (ptField) {
                const activeBtn = ptField.querySelector('.field-status button[class*="active-"]');
                if (activeBtn && activeBtn.dataset.status === 'wrong') {
                    const sel = ptField.querySelector('.correction-sp-field');
                    if (sel && sel.value) effective = sel.value;
                }
            }
            return effective;
        }

        // "validate": the intersection coords already exist in the JSON -> validate with correct/wrong
        // "insert": place type was corrected to intersection -> the coords only need to be inserted
        function intersectionMode() {
            if (getEffectivePlaceType() !== 'intersection') return null;
            const event = getEvent();
            const gi = (event && event.geocoded_intersection) || {};
            return (gi.latitude != null || gi.longitude != null) ? 'validate' : 'insert';
        }

        function renderIntersectionInsert(name, label) {
            const saved = getSavedFieldState(savedFieldsCache, name);
            const val = (saved && saved.correction != null) ? String(saved.correction) : '';
            return `
                <div class="validation-field" data-field="${name}" data-insert="1" style="margin:4px 0 4px 148px;">
                    <div class="field-row">
                        <div class="field-info">
                            <div class="field-name">${label}</div>
                            <div class="field-value">
                                <div class="new-field-wrap">
                                    <input type="number" step="0.0000001" class="sp-field-input" placeholder="${label}" value="${val}">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        function updateIntersectionFields() {
            const container = document.getElementById('intersectionFields');
            if (!container) return;
            const mode = intersectionMode();
            let changed = false;

            if (!mode) {
                if (container.innerHTML !== '') {
                    container.innerHTML = '';
                    container.dataset.mode = '';
                    changed = true;
                }
            } else if (!(container.dataset.mode === mode && container.querySelector('.validation-field'))) {
                const event = getEvent();
                const gi = (event && event.geocoded_intersection) || {};
                let html = '<div class="section-header"><i class="fas fa-location-crosshairs"></i> Intersection Coordinates</div>';

                if (mode === 'validate') {
                    html += renderField('geocoded_intersection.latitude', getVal(gi.latitude), getSavedFieldState(savedFieldsCache, 'geocoded_intersection.latitude'));
                    html += renderField('geocoded_intersection.longitude', getVal(gi.longitude), getSavedFieldState(savedFieldsCache, 'geocoded_intersection.longitude'));
                } else {
                    html += renderIntersectionInsert('geocoded_intersection.latitude', 'Latitude');
                    html += renderIntersectionInsert('geocoded_intersection.longitude', 'Longitude');
                }

                container.innerHTML = html;
                container.dataset.mode = mode;
                changed = true;

                if (mode === 'insert') {
                    container.querySelectorAll('.sp-field-input').forEach(inp => {
                        inp.addEventListener('input', updateProgress);
                        inp.addEventListener('change', updateProgress);
                    });
                }
            }

            if (changed) updateProgress();
        }

        // Green border when an inserted intersection coordinate is filled, plus
        // an inline alert while it is still empty.
        function updateIntersectionInsertFields() {
            const container = document.getElementById('intersectionFields');
            if (!container) return;
            container.querySelectorAll('.validation-field[data-insert="1"]').forEach(field => {
                const input = field.querySelector('.sp-field-input');
                const filled = !!(input && input.value && String(input.value).trim() !== '');
                field.classList.toggle('status-correct', filled);
                let alert = field.querySelector('.field-alert');
                if (filled) {
                    if (alert) alert.remove();
                    return;
                }
                if (!alert) {
                    const name = field.dataset.field || '';
                    const label = name.endsWith('latitude') ? 'latitude' : 'longitude';
                    alert = document.createElement('div');
                    alert.className = 'field-alert';
                    alert.innerHTML = '<i class="fas fa-triangle-exclamation"></i> Please insert the ' + label + ' to complete.';
                    field.appendChild(alert);
                }
            });
        }

        // Green border when an added place field is filled (or Null checked),
        // plus an inline alert while it is still empty.
        function updateAddedPlaceFieldStates() {
            document.querySelectorAll('.sp-row[data-added="1"] .validation-field').forEach(field => {
                const complete = isAddedFieldComplete(field);
                field.classList.toggle('status-correct', complete);
                let alert = field.querySelector('.field-alert');
                if (complete) {
                    if (alert) alert.remove();
                    return;
                }
                const input = field.querySelector('.sp-field-input');
                const provSelect = field.querySelector('.validation-prov-select');
                const noneCheck = field.querySelector('.new-field-none-check');
                const hasVal = !!(input && input.value && String(input.value).trim() !== '');
                const msg = (provSelect && hasVal && !(noneCheck && noneCheck.checked) && !provSelect.value)
                    ? 'Please select the validation provenance.'
                    : 'Please insert the value or check "Null".';
                if (!alert) {
                    alert = document.createElement('div');
                    alert.className = 'field-alert';
                    field.appendChild(alert);
                }
                alert.innerHTML = '<i class="fas fa-triangle-exclamation"></i> ' + msg;
            });
        }

        function updatePlacesWarning() {
            const warnEl = document.getElementById('placesWarning');
            if (!warnEl) return false;
            const event = getEvent();
            if (!event) { warnEl.style.display = 'none'; return false; }

            const effective = getEffectivePlaceType();

            let count = 0;
            document.querySelectorAll('.sp-row').forEach(row => {
                if (row.classList.contains('sp-disabled') || row.classList.contains('status-deleted')) return;
                count++;
            });

            let invalid = false;
            let msg = '';
            const places = count + ' place' + (count === 1 ? ' is' : 's are');
            if (effective === 'single' && count !== 1) {
                invalid = true;
                msg = 'This event is set to a single place, but ' + places + ' present. Adjust the places or change the place type.';
            } else if (effective === 'intersection' && count !== 2) {
                invalid = true;
                msg = 'This event is set to an intersection, which requires exactly two places, but ' + places + ' present. Adjust the places or change the place type.';
            } else if (effective === 'multiple' && count < 2) {
                invalid = true;
                msg = 'This event is set to multiple places, but ' + places + ' present. Add another place or change the place type.';
            }
            if (invalid) {
                warnEl.innerHTML = '<i class="fas fa-triangle-exclamation"></i> ' + msg;
                warnEl.style.display = 'flex';
            } else {
                warnEl.style.display = 'none';
            }
            return invalid;
        }

        function updateProgress() {
            updateIntersectionInsertFields();
            updateAddedPlaceFieldStates();
            const placesInvalid = updatePlacesWarning();
            const locked = isValidationLocked();
            // Temporal/loc-span validation is suspended while locked, so it can
            // never block the save.
            const newsInvalid = locked ? false : !newsSpansState().complete;
            if (!newsInvalid) setNewsWarning(false);
            const newsScroll = document.querySelector('.news-text-scroll');
            if (newsScroll && !locked) {
                const textValid = newsTextValid();
                newsScroll.classList.toggle('news-complete', textValid);
                newsScroll.classList.toggle('news-invalid', !textValid && newsTextTouched());
            }
            const unmatchedBox = document.getElementById('newsUnmatchedBox');
            if (unmatchedBox && !locked) {
                const items = unmatchedBox.querySelectorAll('.news-unmatched-item');
                const marked = unmatchedBox.querySelectorAll('.news-unmatched-item input[type="radio"]:checked').length;
                unmatchedBox.classList.toggle('news-complete', items.length > 0 && marked >= items.length);
            }
            if (locked) {
                document.querySelector('.news-text-scroll')?.classList.remove('news-complete', 'news-invalid');
                document.getElementById('newsUnmatchedBox')?.classList.remove('news-complete');
                document.getElementById('progressFill').style.width = '100%';
                document.getElementById('progressText').textContent = lockReason();
                const blocked = placesInvalid || newsInvalid;
                document.querySelectorAll('.btn-save-validation').forEach(saveBtn => {
                    saveBtn.disabled = blocked;
                    saveBtn.style.opacity = blocked ? '0.5' : '1';
                    saveBtn.style.cursor = blocked ? 'not-allowed' : 'pointer';
                });
                return;
            }
            const fields = document.querySelectorAll('.validation-field');
            const kiRows = document.querySelectorAll('.ki-row:not([data-added="1"])');
            const spRows = document.querySelectorAll('.sp-row');
            let total = 0;
            let done = 0;
            fields.forEach(el => {
                if (el.closest('.sp-row')) return;
                total++;
                if (el.dataset.insert === '1') {
                    const input = el.querySelector('.sp-field-input');
                    if (input && input.value && String(input.value).trim() !== '') done++;
                    return;
                }
                const activeBtn = el.querySelector('.field-status button[class*="active-"]');
                if (activeBtn && isWrongFieldComplete(el)) done++;
            });
            kiRows.forEach(row => {
                total++;
                if (row.classList.contains('status-deleted')) { done++; return; }
                const activeBtn = row.querySelector('.ki-status button[class*="active-"]');
                if (activeBtn) done++;
            });
            spRows.forEach(row => {
                // Count each field in the place
                const placeFields = row.querySelectorAll('.validation-field');
                if (row.classList.contains('sp-disabled') || row.classList.contains('status-deleted')) {
                    // Existing place disabled/deleted — its fields are considered satisfied
                    total += placeFields.length;
                    done += placeFields.length;
                    return;
                }
                if (row.dataset.added === '1') {
                    // Added place — each field must be filled or marked None
                    placeFields.forEach(f => {
                        total++;
                        if (isAddedFieldComplete(f)) done++;
                    });
                    return;
                }
                placeFields.forEach(f => {
                    total++;
                    const activeBtn = f.querySelector('.field-status button[class*="active-"]');
                    if (activeBtn && isWrongFieldComplete(f)) done++;
                });
            });
            // The news text is one field, complete only when all predicted spans are reviewed.
            total += 1;
            if (!newsInvalid) done += 1;
            const pct = Math.round((done / total) * 100);
            document.getElementById('progressFill').style.width = pct + '%';
            document.getElementById('progressText').textContent = `${done} / ${total} fields validated`;

            const blocked = done < total || placesInvalid;
            document.querySelectorAll('.btn-save-validation').forEach(saveBtn => {
                saveBtn.disabled = blocked;
                saveBtn.style.opacity = blocked ? '0.5' : '1';
                saveBtn.style.cursor = blocked ? 'not-allowed' : 'pointer';
            });
        }

        let newsAnnotator = null;
        let newsPopoverEl = null;
        let newsPopoverAnnId = null;
        let lastNewsPointer = { x: 0, y: 0 };
        let newsInteracted = false;

        const NEWS_LOC = 'loc_span';
        const NEWS_TEMPORAL = 'temporal_expression';

        // The whole news text counts as a single field: it is complete only when
        // every predicted span has been reviewed (confirmed or marked wrong), every
        // user-added span has been given a type (location / temporal) and every
        // unmatched span (reformulation / hallucination) has been marked.
        function newsSpansState() {
            let total = 0, done = 0;
            if (newsAnnotator) {
                (newsAnnotator.getAnnotations() || []).forEach(a => {
                    const v = a.validation || {};
                    if (v.source === 'predicted') {
                        total++;
                        if (v.confirmed === true || v.wrong === true) done++;
                    } else {
                        total++;
                        if (v.type === NEWS_LOC || v.type === NEWS_TEMPORAL) done++;
                    }
                });
            }
            document.querySelectorAll('.news-unmatched-item').forEach(item => {
                total++;
                if (item.querySelector('input[type="radio"]:checked')) done++;
            });
            return { total: total, done: done, complete: done >= total };
        }

        // The in-text box is green only when every predicted span is confirmed
        // (nothing pending/wrong) and no span has been added. It stays neutral
        // until the user actually decides something, then turns red if invalid.
        function newsTextValid() {
            if (!newsAnnotator) return false;
            let hasAdded = false, allConfirmed = true;
            (newsAnnotator.getAnnotations() || []).forEach(a => {
                const v = a.validation || {};
                if (v.source === 'predicted') {
                    if (v.confirmed !== true) allConfirmed = false;
                } else {
                    hasAdded = true;
                }
            });
            return allConfirmed && !hasAdded;
        }

        function newsTextTouched() {
            if (!newsAnnotator) return false;
            return (newsAnnotator.getAnnotations() || []).some(a => {
                const v = a.validation || {};
                if (v.source === 'predicted') return v.confirmed === true || v.wrong === true;
                return true;
            });
        }

        function setNewsWarning(show) {
            const el = document.getElementById('newsWarning');
            if (!el) return;
            if (show) {
                el.innerHTML = '<i class="fas fa-triangle-exclamation"></i> Some spans are not reviewed yet: confirm or mark each predicted span, and give a type (Location or Temporal) to every span you added.';
                el.style.display = 'flex';
            } else {
                el.style.display = 'none';
            }
        }

        // Reconcile the alert with the current span state (show when there is
        // still something to review, hide once everything is done).
        function refreshNewsWarning() {
            setNewsWarning(newsInteracted && !newsSpansState().complete);
        }

        // Case-insensitive first occurrence of `needle` in `haystack`, returning
        // the index in the original string (so position selectors stay correct).
        function newsIndexOf(haystack, needle, from = 0) {
            if (!needle) return -1;
            const lowerHay = haystack.toLowerCase();
            const lowerNeedle = needle.toLowerCase();
            // toLowerCase can change length for a few Unicode chars; fall back to
            // comparing equal-length windows of the original then.
            if (lowerHay.length === haystack.length && lowerNeedle.length === needle.length) {
                return lowerHay.indexOf(lowerNeedle, Math.max(0, from));
            }
            const nLen = needle.length;
            for (let i = Math.max(0, from); i + nLen <= haystack.length; i++) {
                if (haystack.substr(i, nLen).toLowerCase() === lowerNeedle) return i;
            }
            return -1;
        }

        // Build W3C annotations for the first occurrence of every all_loc_span /
        // all_temporal_expressions entry. The type + verdict ride in a custom
        // top-level `validation` field (preserved by the W3C adapter on round-trip).
        function buildPredictedNewsAnnotations(event, text) {
            const anns = [];
            const add = (spans, type, prefix) => {
                (spans || []).forEach((span, i) => {
                    if (!span) return;
                    const start = newsIndexOf(text, span);
                    if (start < 0) return;
                    anns.push({
                        id: 'pred-' + prefix + '-' + i,
                        body: [],
                        target: {
                            selector: [
                                { type: 'TextQuoteSelector', exact: text.substr(start, span.length) },
                                { type: 'TextPositionSelector', start: start, end: start + span.length }
                            ]
                        },
                        validation: { type: type, wrong: false, source: 'predicted' }
                    });
                });
            };
            add(event.all_loc_span, NEWS_LOC, 'loc');
            add(event.all_temporal_expressions, NEWS_TEMPORAL, 'temp');
            return anns;
        }

        // Predicted spans (all_loc_span / all_temporal_expressions) that have no
        // occurrence in the article text — the model either reformulated them or
        // hallucinated. These cannot be annotated in the text, so they get their
        // own review box (reformulation / hallucination).
        function getUnmatchedNewsSpans(event) {
            const text = typeof event.text === 'string' ? event.text : '';
            const result = [];
            if (!text.trim()) return result;
            const add = (spans, type) => {
                (spans || []).forEach(span => {
                    if (!span) return;
                    if (newsIndexOf(text, span) < 0) result.push({ value: span, type: type });
                });
            };
            add(event.all_loc_span, NEWS_LOC);
            add(event.all_temporal_expressions, NEWS_TEMPORAL);
            return result;
        }

        function escapeNewsHtml(value) {
            return String(value == null ? '' : value)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;')
                .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }

        // Linear RGB mix of two #rrggbb colours (t=0 -> a, t=1 -> b).
        function newsMixHex(a, b, t) {
            const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
            const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
            return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
        }

        function newsRgba(hex, a) {
            const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
            return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + a + ')';
        }

        // Base colours for the two span types plus the neutral grey.
        const NEWS_GREY = '#9e9e9e';
        const newsBaseColor = type => (type === NEWS_LOC ? '#2196f3' : (type === NEWS_TEMPORAL ? '#ff9800' : null));

        // Predicted spans are reviewed, not typed: `confirmed` brightens the
        // original colour, `wrong` blends it halfway to grey. User-added spans
        // share the confirmed look so they can't be mistaken for unreviewed
        // predicted spans.
        function newsHighlightStyle(annotation, state) {
            const v = annotation.validation || {};
            const base = newsBaseColor(v.type);
            const isPredicted = v.source === 'predicted';

            if (!base) {
                return { fill: NEWS_GREY, fillOpacity: state && state.hovered ? 0.4 : 0.22, underlineColor: NEWS_GREY, underlineThickness: 1 };
            }
            if (v.wrong) {
                const c = newsMixHex(base, NEWS_GREY, 0.5);
                return { fill: c, fillOpacity: 0.5, underlineColor: newsRgba(c, 0.5), underlineThickness: 3 };
            }
            if (v.confirmed || !isPredicted) {
                const c = newsMixHex(base, '#ffffff', 0.4);
                return { fill: c, fillOpacity: 1, underlineColor: c, underlineThickness: 3 };
            }
            return { fill: base, fillOpacity: v.type === NEWS_LOC ? 0.18 : 0.22, underlineColor: base, underlineThickness: 2 };
        }

        // Pull the quote text / offsets out of an annotation (W3C or internal).
        function newsSelectorParts(annotation) {
            const target = Array.isArray(annotation.target) ? annotation.target[0] : annotation.target;
            const selectors = Array.isArray(target.selector) ? target.selector : [target.selector];
            const quoteSel = selectors.find(s => s.type === 'TextQuoteSelector' || s.exact !== undefined);
            const posSel = selectors.find(s => s.type === 'TextPositionSelector' || s.start !== undefined);
            return {
                exact: quoteSel ? (quoteSel.exact !== undefined ? quoteSel.exact : quoteSel.quote) : '',
                start: posSel ? posSel.start : 0,
                end: posSel ? posSel.end : 0
            };
        }

        function newsW3C(annotation, validation) {
            const parts = newsSelectorParts(annotation);
            return {
                id: annotation.id,
                body: [],
                target: {
                    selector: [
                        { type: 'TextQuoteSelector', exact: parts.exact },
                        { type: 'TextPositionSelector', start: parts.start, end: parts.end }
                    ]
                },
                validation: validation
            };
        }

        // Serialise the news spans into the compact saved shape:
        //   { predicted_spans: [{ value, type, status }], added_spans: [{ value, type }] }
        function buildAnnotationSpans() {
            const result = { predicted_spans: [], added_spans: [] };
            (newsAnnotator ? (newsAnnotator.getAnnotations() || []) : []).forEach(a => {
                const v = a.validation || {};
                const parts = newsSelectorParts(a);
                if (!parts.exact) return;
                if (v.source === 'predicted') {
                    result.predicted_spans.push({
                        value: parts.exact,
                        type: v.type || null,
                        status: v.wrong ? 'wrong' : 'correct'
                    });
                } else {
                    result.added_spans.push({
                        value: parts.exact,
                        type: v.type || null
                    });
                }
            });
            // Predicted spans absent from the text are still predicted spans;
            // their status records whether they were a reformulation or a hallucination.
            document.querySelectorAll('.news-unmatched-item').forEach(item => {
                const checked = item.querySelector('input[type="radio"]:checked');
                result.predicted_spans.push({
                    value: item.dataset.value || '',
                    type: item.dataset.type || null,
                    status: checked ? checked.value : null
                });
            });
            return result;
        }

        function ensureNewsPopover() {
            if (newsPopoverEl) return;
            newsPopoverEl = document.createElement('div');
            newsPopoverEl.className = 'news-annot-popover';
            newsPopoverEl.style.display = 'none';
            newsPopoverEl.addEventListener('mousedown', e => e.stopPropagation());
            document.body.appendChild(newsPopoverEl);
        }

        function hideNewsPopover() {
            if (newsPopoverEl) newsPopoverEl.style.display = 'none';
            newsPopoverAnnId = null;
        }

        // Hit-test the highlight layer (it is pointer-events:none, so we resolve
        // the span under the cursor ourselves by rectangle).
        function newsAnnotationAtPoint(x, y) {
            const layer = document.querySelector('#newsTextAnnotator .r6o-span-highlight-layer');
            if (!layer) return null;
            let best = null;
            layer.querySelectorAll('.r6o-annotation').forEach(span => {
                const r = span.getBoundingClientRect();
                if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
                    const area = r.width * r.height;
                    if (!best || area < best.area) best = { id: span.dataset.annotation, area: area };
                }
            });
            return best ? best.id : null;
        }

        function showNewsPopover(id) {
            ensureNewsPopover();
            const ann = (newsAnnotator && id) ? newsAnnotator.getAnnotationById(id) : null;
            if (!ann) { hideNewsPopover(); return; }
            newsPopoverAnnId = id;

            const v = ann.validation || {};
            const isPredicted = v.source === 'predicted';
            const isLoc = v.type === NEWS_LOC;
            const isTemp = v.type === NEWS_TEMPORAL;
            const wrong = v.wrong === true;
            const confirmed = v.confirmed === true;

            if (isPredicted) {
                newsPopoverEl.innerHTML =
                    '<div class="nap-title">Predicted span</div>' +
                    '<div class="nap-row">' +
                        '<button type="button" class="nap-btn' + (confirmed ? ' active' : '') + '" data-act="confirm">' + (confirmed ? 'Confirmed' : 'Confirm') + '</button>' +
                        '<button type="button" class="nap-btn' + (wrong ? ' active-wrong' : '') + '" data-act="wrong">' + (wrong ? 'Marked wrong' : 'Mark as wrong') + '</button>' +
                    '</div>';
            } else {
                newsPopoverEl.innerHTML =
                    '<div class="nap-title">Added span</div>' +
                    '<div class="nap-row"><span class="nap-label">Type</span>' +
                        '<button type="button" class="nap-btn' + (isLoc ? ' active' : '') + '" data-type="' + NEWS_LOC + '">Location</button>' +
                        '<button type="button" class="nap-btn' + (isTemp ? ' active' : '') + '" data-type="' + NEWS_TEMPORAL + '">Temporal</button>' +
                    '</div>' +
                    '<div class="nap-row">' +
                        '<button type="button" class="nap-btn nap-remove" data-act="remove">Remove</button>' +
                    '</div>';
            }

            let px = lastNewsPointer.x, py = lastNewsPointer.y;
            const sel = window.getSelection();
            if (sel && sel.rangeCount && !sel.isCollapsed) {
                const r = sel.getRangeAt(0).getBoundingClientRect();
                if (r && (r.width || r.height)) { px = r.left; py = r.bottom; }
            }

            newsPopoverEl.style.display = 'block';
            const w = newsPopoverEl.offsetWidth || 220;
            const h = newsPopoverEl.offsetHeight || 90;
            newsPopoverEl.style.left = Math.max(8, Math.min(px, window.innerWidth - w - 8)) + 'px';
            newsPopoverEl.style.top = Math.max(8, Math.min(py + 8, window.innerHeight - h - 8)) + 'px';

            newsPopoverEl.querySelectorAll('.nap-btn').forEach(btn => {
                btn.onclick = (ev) => { ev.preventDefault(); ev.stopPropagation(); onNewsPopoverAction(btn); };
            });
        }

        function onNewsPopoverAction(btn) {
            const id = newsPopoverAnnId;
            if (!id || !newsAnnotator) return;
            const ann = newsAnnotator.getAnnotationById(id);
            if (!ann) { hideNewsPopover(); return; }

            const v = Object.assign({}, ann.validation || {});

            // User-added spans can be removed entirely (predicted spans cannot:
            // they must be confirmed or marked wrong).
            if (btn.dataset.act === 'remove' && v.source !== 'predicted') {
                try { newsAnnotator.removeAnnotation(ann); } catch (e) {}
                hideNewsPopover();
                updateProgress();
                setTimeout(updateProgress, 0);
                return;
            }

            if (btn.dataset.type) v.type = btn.dataset.type;
            if (btn.dataset.act === 'confirm') {
                v.confirmed = !(v.confirmed === true);
                if (v.confirmed) v.wrong = false;
            }
            if (btn.dataset.act === 'wrong') {
                v.wrong = !(v.wrong === true);
                if (v.wrong) v.confirmed = false;
            }

            try {
                newsAnnotator.updateAnnotation(newsW3C(ann, v));
            } catch (e) {
                console.warn('Could not update news annotation.', e);
            }
            showNewsPopover(id);
            updateProgress();
        }

        // Mount the Recogito text annotator on the news text. The predicted
        // loc/temporal spans and any user-added spans are all annotations; the
        // user edits their type / "wrong" verdict through the popover.
        function initNewsAnnotator(event, savedState) {
            const el = document.getElementById('newsTextAnnotator');
            if (!el) return;

            if (newsAnnotator) {
                try { newsAnnotator.destroy(); } catch (e) {}
                newsAnnotator = null;
            }
            hideNewsPopover();

            const text = typeof event.text === 'string' ? event.text : '';
            if (!text.trim()) {
                el.classList.add('no-text');
                el.textContent = 'News text not available for this article.';
                return;
            }

            if (!window.RecogitoJS || !window.RecogitoJS.createTextAnnotator) {
                el.textContent = text;
                console.warn('Recogito Text Annotator failed to load.');
                return;
            }

            el.textContent = text;
            el.addEventListener('mousedown', e => { lastNewsPointer = { x: e.clientX, y: e.clientY }; newsInteracted = true; });
            el.addEventListener('mouseup', e => { lastNewsPointer = { x: e.clientX, y: e.clientY }; });
            // Re-open the popover for an already-selected span (clicking a
            // selected annotation does not emit selectionChanged again).
            el.addEventListener('click', e => {
                const annId = newsAnnotationAtPoint(e.clientX, e.clientY);
                if (annId) showNewsPopover(annId);
            });

            try {
                const adapter = window.RecogitoJS.W3CTextFormat(event.url || 'news-text', el);
                newsAnnotator = window.RecogitoJS.createTextAnnotator(el, {
                    adapter: adapter,
                    userSelectAction: 'SELECT',
                    style: newsHighlightStyle
                });

                newsAnnotator.on('createAnnotation', ann => { if (ann && ann.id) { showNewsPopover(ann.id); updateProgress(); } });
                newsAnnotator.on('selectionChanged', sel => {
                    if (sel && sel.length === 1) showNewsPopover(sel[0].id);
                    else hideNewsPopover();
                });

                const spans = savedState && savedState.annotation_spans;
                if (spans && (Array.isArray(spans.predicted_spans) || Array.isArray(spans.added_spans))) {
                    // Rebuild predicted spans from the event, then re-apply the saved status.
                    const statusByKey = {};
                    (spans.predicted_spans || []).forEach(s => {
                        if (s && s.value) statusByKey[(s.value + '\u0000' + (s.type || '')).toLowerCase()] = s.status;
                    });
                    buildPredictedNewsAnnotations(event, text).forEach(a => {
                        const key = (a.target.selector[0].exact + '\u0000' + (a.validation.type || '')).toLowerCase();
                        const status = statusByKey[key];
                        if (status === 'wrong') a.validation.wrong = true;
                        else if (status === 'correct') a.validation.confirmed = true;
                        newsAnnotator.addAnnotation(a);
                    });
                    // Re-create added spans from their text value (first occurrence).
                    (spans.added_spans || []).forEach((s, i) => {
                        if (!s || !s.value) return;
                        const start = newsIndexOf(text, s.value);
                        if (start < 0) return;
                        newsAnnotator.addAnnotation({
                            id: 'added-' + i + '-' + Date.now(),
                            body: [],
                            target: {
                                selector: [
                                    { type: 'TextQuoteSelector', exact: text.substr(start, s.value.length) },
                                    { type: 'TextPositionSelector', start: start, end: start + s.value.length }
                                ]
                            },
                            validation: { type: s.type || null }
                        });
                    });
                } else if (savedState && Array.isArray(savedState.annotations) && savedState.annotations.length) {
                    newsAnnotator.setAnnotations(savedState.annotations);
                } else {
                    buildPredictedNewsAnnotations(event, text).forEach(a => newsAnnotator.addAnnotation(a));
                }
            } catch (e) {
                console.warn('Could not initialize the text annotator.', e);
            }
            updateProgress();
        }

        document.addEventListener('mousedown', (e) => {
            const target = e.target;
            const inPopover = newsPopoverEl && target && newsPopoverEl.contains(target);
            if (newsPopoverEl && newsPopoverEl.style.display !== 'none' && !inPopover) hideNewsPopover();

            const insideNews = target && target.closest && target.closest('#newsTextAnnotator, .news-text-scroll, .news-annot-popover');
            if (!insideNews) { updateProgress(); refreshNewsWarning(); }
        });


        async function render() {
            const event = getEvent();
            const container = document.getElementById('validationContent');

            if (!event) {
                container.innerHTML = `
                    <div class="no-event">
                        <i class="fas fa-inbox"></i>
                        <h2>No event selected</h2>
                        <p>Go back to the dashboard and click "Validate" on an event card.</p>
                        <button class="btn-back" onclick="window.location.href='event_atlas.html'" style="margin:16px auto;">
                            <i class="fas fa-arrow-left"></i> Back to dashboard
                        </button>
                    </div>
                `;
                return;
            }

            const cfg = categoryConfig[event.category] || categoryConfig.other;
            const fields = getAllFieldNames(event);
            const keyInfoFields = fields.filter(f => f.startsWith('key_info.'));

            const firstPlace = event.single_places?.[0] || {};
            
            const groups = [
                { label: '<i class="fas fa-tag"></i> General', keys: ['is_event', 'category', 'multi_event'] },
                { label: '<i class="fas fa-calendar"></i> Start Date', keys: ['start_date.day', 'start_date.month', 'start_date.year'] },
                { label: '<i class="fas fa-calendar-check"></i> End Date', keys: ['end_date.day', 'end_date.month', 'end_date.year'] },
            ];
            const totalFields = groups.reduce((s, g) => s + g.keys.length, 0) + keyInfoFields.length;

            let savedState = null;
            try {
                const resp = await fetch('/api/validated-news');
                if (resp.ok) {
                    const list = await resp.json();
                    savedState = (list || []).find(x => x && x.url === event.url) || null;
                }
            } catch (e) {}

            const savedFields = savedState?.fields || {};
            savedFieldsCache = savedFields;

            container.innerHTML = `
                <div class="validation-meta" style="grid-template-columns:1fr 1fr 1fr;">
                    <div class="meta-item">
                        <div class="meta-label">Newspaper</div>
                        <div class="meta-value">${event.newspaper || '—'}</div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-label">URL</div>
                        <div class="meta-value" style="font-size:12px;word-break:break-all;">${event.url ? '<a href="'+event.url+'" target="_blank" style="color:var(--accent);text-decoration:none;">'+event.url+'</a>' : '—'}</div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-label">Publication Date</div>
                        <div class="meta-value">${formatDate(event.publication_date) || '—'}</div>
                    </div>
                </div>

                <div class="progress-text" id="progressText">0 / ${totalFields} fields validated</div>
                <div class="progress-bar">
                    <div class="progress-fill" id="progressFill" style="width:0%"></div>
                </div>

                <div class="validation-fields">
                    ${(() => {
                        let html = '';
                        for (const group of groups) {
                            html += '<div class="section-header">' + group.label + '</div>';
                            if (group.keys.includes('osm_type')) {
                                const city = event.geocoded_city ? event.geocoded_city.split(',')[0].trim() : '—';
                                html += '<div style="padding:8px 12px;font-size:13px;color:var(--text-muted);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;"><span style="font-weight:600;">Geocoded city</span><span>' + city + '</span></div>';
                            }
                            for (const f of group.keys) {
                                let val;
                                if (f === 'multi_event') {
                                    val = event.multi_event || 'single';
                                }
                                if (f.includes('[')) {
                                    const match = f.match(/^(.+?)\[(\d+)\]\.(.+)$/);
                                    if (match) {
                                        const [, arrName, idx, key] = match;
                                        const arr = event[arrName];
                                        val = arr && arr[idx] ? getVal(arr[idx][key]) : null;
                                    }
                                } else if (f.includes('.')) {
                                    const [obj, key] = f.split('.');
                                    val = event[obj] ? getVal(event[obj][key]) : null;
                                } else if (val === undefined) {
                                    val = getVal(event[f]);
                                }
                                html += renderField(f, val, getSavedFieldState(savedFields, f));
                            }
                        }
html += '<div class="section-header"><i class="fas fa-map-marker-alt"></i> Locations</div>';
                        html += renderField('place_type', event.place_type || 'single', savedFields.place_type);
                        html += '<div id="placesWarning" class="places-warning" style="display:none;"></div>';
                        const places = event.single_places || [];
                        const savedPlaces = savedFields._single_places || savedFields.single_places || [];
                        places.forEach((place, idx) => {
                            const savedPlaceRow = savedPlaces[idx] || {};
                            // Saved places are stored as { fields: {...} }; older data may be flat.
                            const savedPlace = savedPlaceRow.fields || savedPlaceRow;
                            const placePrefix = 'single_places[' + idx + ']';
                            const isDeleted = savedPlaceRow.deleted === true;
                            const cls = isDeleted ? 'sp-row status-deleted' : (savedPlaceRow.status === 'correct' ? 'sp-row status-correct' : (savedPlaceRow.status === 'wrong' ? 'sp-row status-wrong' : 'sp-row'));
                            const dis = isDeleted ? 'disabled' : '';
                            
                            const specificNameVal = getVal(place.specific_name_place);
                            const addressVal = getVal(place.address);
                            const cityVal = getVal(place.city);
                            const countyVal = getVal(place.county);
                            const hamletVal = getVal(place.hamlet);
                            const urbanZoneVal = getVal(place.urban_zone);
                            const latVal = getVal(place.latitude);
                            const lngVal = getVal(place.longitude);
                            const osmTypeVal = getVal(place.osm_type);
                            const osmIdVal = getVal(place.osm_id);
                            
                            // Get provenance from original event data
                            const specificNameProv = getProv(place.specific_name_place);
                            const addressProv = getProv(place.address);
                            const cityProv = getProv(place.city);
                            const countyProv = getProv(place.county);
                            const hamletProv = getProv(place.hamlet);
                            const urbanZoneProv = getProv(place.urban_zone);
                            const latProv = getProv(place.latitude);
                            const lngProv = getProv(place.longitude);
                            const osmTypeProv = getProv(place.osm_type);
                            const osmIdProv = getProv(place.osm_id);
                            
                            // Each place in its own subsection with delete button
                            html += '<div class="' + cls + '" data-sp-index="' + idx + '">';
                            html += '  <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;">';
                            html += '    <div class="section-header" style="margin:0;padding:0;flex:1;"><i class="fas fa-map-marker"></i> Place #' + (idx + 1) + '</div>';
                            html += '    <div class="sp-status" style="display:flex;gap:3px;">';
                            html += '      <button type="button" class="' + (isDeleted ? 'active-deleted' : 'btn-delete') + '" data-status="deleted" title="Remove place" onclick="setSPStatus(this, ' + idx + ')"><i class="fas fa-trash"></i></button>';
                            html += '    </div>';
                            html += '  </div>';
                            
                            // Address field
                            html += renderSPField(placePrefix + '.specific_name_place', 'Specific name place', specificNameVal, savedPlace.specific_name_place, dis, 'text', '', null, false, specificNameProv);
                            html += renderSPField(placePrefix + '.address', 'Address', addressVal, savedPlace.address, dis, 'text', '', null, false, addressProv);
                            html += renderSPField(placePrefix + '.city', 'City', cityVal, savedPlace.city, dis, 'text', '', null, false, cityProv);
                            html += renderSPField(placePrefix + '.county', 'County', countyVal, savedPlace.county, dis, 'text', '', null, false, countyProv);
                            html += renderSPField(placePrefix + '.hamlet', 'Hamlet', hamletVal, savedPlace.hamlet, dis, 'text', '', null, false, hamletProv);
                            html += renderSPField(placePrefix + '.urban_zone', 'Urban Zone', urbanZoneVal, savedPlace.urban_zone, dis, 'text', '', null, false, urbanZoneProv);
                            html += renderSPField(placePrefix + '.latitude', 'Latitude', latVal, savedPlace.latitude, dis, 'number', 'step="0.0000001"', null, false, latProv);
                            html += renderSPField(placePrefix + '.longitude', 'Longitude', lngVal, savedPlace.longitude, dis, 'number', 'step="0.0000001"', null, false, lngProv);
                            const osmTypeOptions = ['node', 'way', 'relation'].filter(o => o !== osmTypeVal);
                            html += renderSPField(placePrefix + '.osm_type', 'OSM Type', osmTypeVal, savedPlace.osm_type, dis, 'select', '', osmTypeOptions, false, osmTypeProv);
                            html += renderSPField(placePrefix + '.osm_id', 'OSM ID', osmIdVal, savedPlace.osm_id, dis, 'number', 'step="1" min="0"', null, false, osmIdProv);
                            
                            html += '</div>';
                        });
                        html += '<button class="sp-add-btn" onclick="addSPField()"><i class="fas fa-plus"></i> Add Location</button>';
                        html += '<div id="intersectionFields"></div>';

                        // News Text section — Recogito text annotator (loc/temporal spans)
                        html += '<div class="section-header"><i class="fas fa-newspaper"></i> News Text</div>';
                        html += '<div class="news-text-legend">';
                        html += '  <span><span class="ref-swatch ref-loc"></span>Locations (all_loc_span)</span>';
                        html += '  <span><span class="ref-swatch ref-temporal"></span>Temporal expressions</span>';
                        html += '  <span style="margin-left:auto;">Select text to add a span · click a span to review it</span>';
                        html += '</div>';
                        html += '<div class="news-text-scroll"><div id="newsTextAnnotator" class="news-text-annotator"></div></div>';

                        // Spans predicted but absent from the text (reformulation / hallucination)
                        const unmatchedSpans = getUnmatchedNewsSpans(event);
                        const savedPredicted = (savedState && savedState.annotation_spans && savedState.annotation_spans.predicted_spans) || [];
                        const unmatchedStatus = {};
                        savedPredicted.forEach(s => { if (s && s.value) unmatchedStatus[s.value + '\u0000' + (s.type || '')] = s.status; });
                        html += '<div id="newsUnmatchedBox" class="news-unmatched-box"' + (unmatchedSpans.length ? '' : ' style="display:none;"') + '>';
                        html += '  <div class="section-header"><i class="fas fa-triangle-exclamation"></i> Spans not found in the text</div>';
                        html += '  <div class="news-unmatched-hint">These predicted spans have no occurrence in the article text (the model reformulated them or hallucinated them). Mark each one.</div>';
                        unmatchedSpans.forEach((s, i) => {
                            const st = unmatchedStatus[s.value + '\u0000' + (s.type || '')];
                            const isTemp = s.type === NEWS_TEMPORAL;
                            html += '<div class="news-unmatched-item" data-value="' + escapeNewsHtml(s.value) + '" data-type="' + s.type + '">';
                            html += '  <div class="nu-main"><span class="nu-value">' + escapeNewsHtml(s.value) + '</span><span class="nu-type nu-type-' + (isTemp ? 'temporal' : 'loc') + '">' + (isTemp ? 'Temporal' : 'Location') + '</span></div>';
                            html += '  <div class="nu-choice">';
                            html += '    <label class="nu-option"><input type="radio" name="news-unmatched-' + i + '" value="reformulation" onchange="updateProgress()"' + (st === 'reformulation' ? ' checked' : '') + '> Reformulation</label>';
                            html += '    <label class="nu-option"><input type="radio" name="news-unmatched-' + i + '" value="hallucination" onchange="updateProgress()"' + (st === 'hallucination' ? ' checked' : '') + '> Hallucination</label>';
                            html += '  </div>';
                            html += '</div>';
                        });
                        html += '</div>';
                        html += '<div id="newsWarning" class="news-warning" style="display:none;"></div>';

                        
                        // Key Info section — custom render with editable key, value, delete, and add-field
                        html += '<div class="section-header"><i class="fas fa-info-circle"></i> Key Info</div>';
                        const addedKIFields = savedFields._added_key_info || [];
                        const allKIFields = keyInfoFields.map(f => {
                            const key = f.replace('key_info.', '');
                            return { field: f, key, original: true };
                        });
                        addedKIFields.forEach((item, i) => {
                            allKIFields.push({ field: 'key_info.__new_' + Date.now() + '_' + i, key: item.key || '', value: item.value || '', original: false });
                        });
                        if (allKIFields.length === 0) {
                            html += '<div style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center;">No key info fields. Click "Add field" below.</div>';
                        } else {
                            allKIFields.forEach((item, _kiIdx) => {
                                const f = item.field;
                                const origKey = item.key;
                                const origVal = item.original ? (event.key_info || {})[origKey] : (item.value || '');
                                if (!item.original) {
                                    html += '<div class="ki-row" data-ki-field="' + f + '" data-added="1">';
                                    html += '  <div style="display:flex;align-items:center;gap:8px;">';
                                    html += '    <div class="ki-inputs">';
                                    html += '      <input type="text" class="ki-key" value="' + origKey.replace(/"/g, '&quot;') + '" placeholder="Key" style="width:160px;flex-shrink:0;font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:600;">';
                                    html += '      <input type="text" class="ki-value" value="' + String(origVal ?? '').replace(/"/g, '&quot;') + '" placeholder="Value" style="flex:1;">';
                                    html += '    </div>';
                                    html += '    <button type="button" class="btn-delete" title="Remove field" onclick="this.closest(\'.ki-row\').remove();updateProgress();" style="width:32px;height:32px;border-radius:6px;border:1.5px solid var(--border);background:var(--bg);cursor:pointer;color:var(--text-muted);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fas fa-times"></i></button>';
                                    html += '  </div>';
                                    html += '</div>';
                                    return;
                                }
                                const saved = (savedFields.key_info || {})[origKey] || {};
                                const st = saved.status || '';
                                const savedKey = (st === 'wrong' && saved.corrected_key) ? saved.corrected_key : origKey;
                                const savedVal = (st === 'wrong' && saved.correction != null) ? saved.correction : origVal;
                                const cls = st === 'deleted' ? 'ki-row status-deleted' : (st === 'correct' ? 'ki-row status-correct' : (st === 'wrong' ? 'ki-row status-wrong' : 'ki-row'));
                                const dis = st === 'deleted' ? 'disabled' : '';
                                html += '<div class="' + cls + '" data-ki-field="' + f + '" data-orig-key="' + origKey.replace(/"/g, '&quot;') + '" data-orig-val="' + String(origVal ?? '').replace(/"/g, '&quot;') + '">';
                                html += '  <div style="display:flex;align-items:center;gap:8px;">';
                                html += '    <div class="ki-inputs">';
                                html += '      <input type="text" class="ki-key" value="' + savedKey.replace(/"/g, '&quot;') + '" placeholder="Key" ' + dis + '>';
                                html += '      <input type="text" class="ki-value" value="' + String(savedVal ?? '').replace(/"/g, '&quot;') + '" placeholder="Value" ' + dis + '>';
                                html += '    </div>';
                                html += '    <div class="ki-status">';
                                html += '      <button type="button" class="' + (st === 'correct' && st !== 'deleted' ? 'active-correct' : '') + '" data-status="correct" title="Correct" onclick="setKIStatus(this)"><i class="fas fa-check"></i></button>';
                                html += '      <button type="button" class="' + (st === 'wrong' && st !== 'deleted' ? 'active-wrong' : '') + '" data-status="wrong" title="Wrong" onclick="setKIStatus(this)"><i class="fas fa-edit"></i></button>';
                                html += '      <button type="button" class="' + (st === 'deleted' ? 'active-deleted' : 'btn-delete') + '" data-status="deleted" title="Delete" onclick="setKIStatus(this)"><i class="fas fa-trash"></i></button>';
                                html += '    </div>';
                                html += '  </div>';
                                html += '</div>';
                            });
                        }
                        html += '<button class="ki-add-btn" onclick="addKIField()"><i class="fas fa-plus"></i> Add field</button>';
                        html += '<div style="margin-top:16px;">';
                        html += '  <div class="section-header" style="border:none;padding-bottom:8px;"><i class="fas fa-comment"></i> Notes</div>';
                        const notesVal = (savedState?.notes || '').replace(/"/g, '&quot;');
                        html += '  <textarea id="validationNotes" placeholder="Add your free comments here..." style="width:100%;min-height:80px;padding:10px 14px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:inherit;font-size:13px;resize:vertical;box-sizing:border-box;">' + notesVal + '</textarea>';
                        html += '</div>';
                        return html;
                    })()}
                </div>

                <div class="validation-actions">
                    <button class="btn-save-validation" onclick="saveValidation()">
                        <i class="fas fa-floppy-disk"></i> Save Validation
                    </button>
                    <button class="btn-save-validation" onclick="saveAndNext()" style="background:var(--text-muted);">
                        <i class="fas fa-forward"></i> Save &amp; Go to list
                    </button>
                </div>
                <div id="validationNotification"></div>
            `;

            updateIntersectionFields();
            initNewsAnnotator(event, savedState);

            const lockKey = currentLockKey();
            if (lockKey) lockValidation(lockKey);
            updateProgress();
        }

        async function saveValidation() {
            const event = getEvent();
            if (!event) return;

            if (!allFieldsValidated()) {
                showNotification('Please validate all fields before saving.', 'error');
                return;
            }

            const fields = getFieldsState();
            const notes = document.getElementById('validationNotes')?.value?.trim() || '';
            const annotationSpans = buildAnnotationSpans();

            const validation = {
                url: event.url,
                date: event.start_date,
                place: event.extracted_place,
                category: event.category,
                newspaper: event.newspaper,
                fields: fields,
                annotation_spans: annotationSpans,
                notes: notes,
                validated_at: new Date().toISOString()
            };

            try {
                const resp = await fetch('/api/validated-news', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(validation)
                });
                if (!resp.ok) throw new Error('Save failed');
                showNotification('Validation saved successfully!', 'success');
            } catch (err) {
                showNotification('Could not save: server unavailable.', 'error');
            }
        }

        async function saveAndNext() {
            await saveValidation();
            window.location.href = 'event_atlas.html';
        }

        function showNotification(msg, type) {
            const el = document.getElementById('validationNotification');
            el.className = 'validation-notification ' + type;
            el.innerHTML = '<i class="fas fa-' + (type === 'success' ? 'check-circle' : 'exclamation-circle') + '"></i> ' + msg;
        }

        document.addEventListener('DOMContentLoaded', render);
