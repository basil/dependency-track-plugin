'use strict';

function getNativeFunction(clazz, func) {
    const frame = document.createElement('iframe');
    frame.style.display = 'none';
    document.body.appendChild(frame);
    const nativeClazz = frame.contentWindow[clazz];
    frame.parentNode.removeChild(frame);
    return nativeClazz.prototype[func];
}

// make String.trim() work again like it should
// otherwise sorting the vue.js-table will not work
if (String.prototype.trim.toString().indexOf('[native code]') === -1) {
    String.prototype.trim = getNativeFunction('String', 'trim');
}
// restore Array.filter ... damn ancient prototype.js!
// otherwise "updateAriaDescribedby" in boostrape-vue (2.21+) will not work because 3rd arg in filter callback is undefined
if (Array.prototype.filter.toString().indexOf('[native code]') === -1) {
    Array.prototype.filter = getNativeFunction('Array', 'filter');
}

// create vue.js based table
(function () {
    const actionUrl = new URL(document.currentScript.dataset.actionUrl, window.location.origin);
    if (!(actionUrl.origin === window.location.origin
            && /^https?:$/.test(actionUrl.protocol)
            && actionUrl.pathname.startsWith(`${document.head.dataset.rooturl}/$stapler/bound/`)
        )) {
        throw new Error('malicious URL in data-action-url detected!');
    }

    const crumbHeaderName = document.head.dataset.crumbHeader || 'Jenkins-Crumb';
    const crumbValue = document.head.dataset.crumbValue || '';
    const fetchHeaders = {
        'Content-Type': 'application/x-stapler-method-invocation;charset=UTF-8',
        Crumb: crumbValue
    };
    fetchHeaders[crumbHeaderName] = crumbValue;

    /**
     * update severity-bar
     * 
     * @param {object[]} items
     */
    function updateCounter(items) {
        this.countBySeverity.CRITICAL = items.filter(finding => finding.vulnerability.severity === 'CRITICAL').length;
        this.countBySeverity.HIGH = items.filter(finding => finding.vulnerability.severity === 'HIGH').length;
        this.countBySeverity.MEDIUM = items.filter(finding => finding.vulnerability.severity === 'MEDIUM').length;
        this.countBySeverity.LOW = items.filter(finding => finding.vulnerability.severity === 'LOW').length;
        this.countBySeverity.INFO = items.filter(finding => finding.vulnerability.severity === 'INFO').length;
        this.countBySeverity.UNASSIGNED = items.filter(finding => finding.vulnerability.severity === 'UNASSIGNED').length;
    }

    /**
     * Trigger pagination to update the number of buttons/pages due to filtering
     * 
     * @param {object[]} items
     */
    function updatePaging(items) {
        this.rows = items.length;
        this.currentPage = 1;
    }

    const app = new Vue({
        el: '#app',
        data: {
            rows: 0,
            perPage: 10,
            currentPage: 1,
            isBusy: false,
            sortBy: 'vulnerability.severityRank',
            sortDesc: false,
            filter: null,
            filterOn: [],
            fields: [
                { key: 'component.name', label: 'Name', sortable: true },
                { key: 'component.version', label: 'Version', sortable: true },
                { key: 'component.group', label: 'Group', sortable: true },
                { key: 'vulnerability.vulnId', label: 'Vulnerability', sortable: true },
                { key: 'vulnerability.severityRank', label: 'Severity', sortable: true },
                { key: 'vulnerability.cweId', label: 'CWE', sortable: true },
            ],
            countBySeverity: {
                CRITICAL: 0,
                HIGH: 0,
                MEDIUM: 0,
                LOW: 0,
                INFO: 0,
                UNASSIGNED: 0
            }
        },
        methods: {
            items(ctx, callback) {
                return window.fetch(`${actionUrl.href}/getFindingsJson`, {
                    method: 'POST',
                    mode: 'cors',
                    cache: 'default',
                    body: '[]',
                    headers: fetchHeaders,
                })
                .then(response => {
                    if (response.ok) {
                        return response.json().then(data => Array.isArray(data) ? data : []);
                    } else {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                }).then(items => {
                    updatePaging.call(this, items);
                    updateCounter.call(this, items);
                    return items;
                });
            },
            onFiltered(filteredItems) {
                updatePaging.call(this, filteredItems);
                updateCounter.call(this, filteredItems);
            },
            matchesFilter(item, term) {
                const keys = this.filterOn.length ? this.filterOn : this.fields.map(field => field.key);
                const accessPaths = { };
                keys.forEach(key => {
                    const parts = key.split('.');
                    if (accessPaths[parts[0]] === undefined) {
                        accessPaths[parts[0]] = [parts[1]];
                    } else {
                        accessPaths[parts[0]].push(parts[1]);
                    }
                });
                const searchValues = [];
                Object.entries(accessPaths).forEach(p1 => {
                    p1[1].forEach(p2 => {
                        if (p1[0] === 'vulnerability' && p2 === 'severityRank') {
                            searchValues.push(item.vulnerability.severity.toLowerCase());
                        } else {
                            searchValues.push(item[p1[0]][p2].toString().toLowerCase());
                        }
                    });
                });
                return searchValues.some(value => value.includes(term.trim().toLowerCase()));
            }
        },
    });
})();
