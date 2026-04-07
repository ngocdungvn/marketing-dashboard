// ============================================
// DigiDash - Data Fetcher
// Fetch & Parse CSV from Google Sheets
// ============================================

const DataService = {
    /**
     * Fetch CSV from a published Google Sheet URL
     * @param {string} url - Published CSV URL
     * @returns {Array<Object>} Parsed data rows
     */
    async fetchCSV(url) {
        if (!url || url.trim() === '') return null;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const text = await response.text();
            return this.parseCSV(text);
        } catch (error) {
            console.error('Fetch error:', error);
            return null;
        }
    },

    /**
     * Parse CSV text into array of objects
     * First row = headers
     */
    parseCSV(text) {
        // Properly handle multi-line quoted fields
        const rows = [];
        let currentRow = [];
        let currentField = '';
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i + 1];

            if (inQuotes) {
                if (char === '"' && nextChar === '"') {
                    currentField += '"';
                    i++; // skip escaped quote
                } else if (char === '"') {
                    inQuotes = false;
                } else {
                    currentField += char;
                }
            } else {
                if (char === '"') {
                    inQuotes = true;
                } else if (char === ',') {
                    currentRow.push(currentField.trim());
                    currentField = '';
                } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
                    currentRow.push(currentField.trim());
                    currentField = '';
                    if (currentRow.some(f => f !== '')) {
                        rows.push(currentRow);
                    }
                    currentRow = [];
                    if (char === '\r') i++; // skip \n after \r
                } else {
                    currentField += char;
                }
            }
        }
        // Push last field and row
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f !== '')) {
            rows.push(currentRow);
        }

        if (rows.length < 2) return [];

        const headers = rows[0];
        const data = [];
        for (let i = 1; i < rows.length; i++) {
            const values = rows[i];
            const row = {};
            headers.forEach((header, idx) => {
                const key = this.normalizeHeader(header) || `_col${idx}`;
                row[key] = values[idx] || '';
            });
            data.push(row);
        }

        return data;
    },

    /**
     * Parse a single CSV line (handles quoted fields with commas)
     */
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    },

    /**
     * Normalize Vietnamese headers to camelCase keys
     */
    normalizeHeader(header) {
        const mapping = {
            // Performance sheet columns
            'stt': 'stt',
            'mã chiến dịch': 'maChienDich',
            'kênh': 'kenh',
            'tháng': 'thang',
            'loại chiến dịch': 'loaiChienDich',
            'tên chiến dịch': 'tenChienDich',
            'mục tiêu': 'mucTieu',
            'mục tiêu chiến dịch': 'mucTieu',
            'năm': 'nam',
            'ngày bắt đầu': 'ngayBatDau',
            'ngày kết thúc': 'ngayKetThuc',
            'ngân sách quảng cáo dự kiến': 'nganSachQCDuKien',
            'ngân sách dự kiến': 'nganSachQCDuKien',
            'đơn hàng trung bình dự kiến': 'donHangTBDuKien',
            'tỷ lệ chuyển đổi dự kiến': 'tyLeChuyenDoiDuKien',
            'cpl dự kiến\nchi phí/1 lead': 'cplDuKien',
            'cpl dự kiến': 'cplDuKien',
            'số đơn hàng kỳ vọng': 'soDonHangKyVong',
            'cps dự kiến\nchi phí/1 đơn hàng': 'cpsDuKien',
            'cps dự kiến': 'cpsDuKien',
            'số lead cần đạt được (khách hàng tiềm năng)': 'soLeadCanDat',
            'số lead cần đạt được': 'soLeadCanDat',
            'doanh số kỳ vọng': 'doanhSoKyVong',
            'số lead thực tế': 'soLeadThucTe',
            'số đơn hàng thực tế': 'soDonHangThucTe',
            'doanh số thực tế': 'doanhSoThucTe',
            'ngân sách chi thực tế': 'nganSachChiThucTe',
            'tỷ lệ chuyển đổi thực tế': 'tyLeChuyenDoiThucTe',
            'cpl thực tế': 'cplThucTe',
            'cps thực tế': 'cpsThucTe',
            'kpi 1': 'kpiName1',
            'giá trị kpi 1': 'kpiValue1',
            'kpi 2': 'kpiName2',
            'giá trị kpi 2': 'kpiValue2',
            'trạng thái': 'trangThai',

            // Content Plan specific
            'đơn vị': 'donVi',
            'target': 'target',
            'thực đạt': 'thucDat',
            'tỷ lệ hoàn thành': 'tyLeHoanThanh',
            'ngày hoàn thành': 'ngayHoanThanh',
            'thời gian bắt đầu': 'thoiGianBatDau',
            'thời gian kết thúc': 'thoiGianKetThuc',

            // KPI Nhân sự specific
            'bộ phận/phòng/ban': 'boPhan',
            'viễn cảnh': 'vienCanh',
            'mục tiêu chiến lược': 'mucTieuChienLuoc',
            'mã kpi': 'maKpi',
            'chiều hướng': 'chieuHuong',
            'nguồn lấy dữ liệu': 'nguonDuLieu',
            'người làm báo cáo': 'nguoiBaoCao',
            'đơn vị tính': 'donViTinh',
            'cách tính % hoàn thành kpi': 'cachTinh',
            'xác thực': 'xacThuc',
            'mã nhân viên': 'maNhanVien',

            // Common date & account columns
            'ngày': 'ngay',
            'tên tài khoản': 'tenTaiKhoan',
            'tên nhóm quảng cáo': 'tenNhomQC',
            'tên quảng cáo': 'tenQC',
            'nhóm quảng cáo': 'tenNhomQC',
            'quảng cáo': 'tenQC',

            // Spending columns (map all variants to 'chiTieu')
            'chi tiêu': 'chiTieu',
            'số tiền đã chi tiêu': 'chiTieu',
            'số tiền đã chi': 'chiTieu',

            // Impression columns
            'hiển thị': 'hienThi',
            'lượt hiển thị': 'hienThi',
            'impressions': 'hienThi',
            'impresions': 'hienThi',  // typo in Google Ads sheet

            // Click columns
            'lượt click': 'clicks',
            'clicks': 'clicks',
            'lượt click vào liên kết': 'clicks',
            'số lần nhấp (tất cả)': 'clicksAll',
            'lượt nhấp': 'clicks',

            // Reach/frequency
            'người tiếp cận': 'reach',
            'tần suất': 'tanSuat',

            // Cost metrics
            'cpc': 'cpc',
            'cpc(chi phí trên mỗi lượt click vào liên kết)': 'cpcLink',
            'cpc (tất cả)': 'cpcAll',
            'ctr': 'ctr',
            'ctr(tất cả)': 'ctrAll',
            'cpm': 'cpm',

            // Conversion columns (map to donHang for compatibility)
            'đơn hàng': 'donHang',
            'lượt chuyển đổi': 'donHang',
            'chi phí trên mỗi lượt chuyển đổi': 'cpConversion',
            'loại chuyển đổi': 'loaiChuyenDoi',

            // Revenue (not in live sheets but keep for demo compatibility)
            'doanh số': 'doanhSo',

            // Social engagement
            'bình luận về bài viết': 'binhLuan',
            'cảm xúc với bài viết': 'camXuc',
            'số lượt chia sẻ bài viết': 'chiaSe',

            // TikTok specific
            'tiktok shop': 'tiktokShop',

            // KPI columns
            'bộ phận': 'boPhan',
            'xác thực': 'xacThuc',
            'stt': 'stt',
            'kpi': 'kpi',
            'trọng số': 'trongSo',
            'kết quả': 'ketQua',

            // Task columns
            'ngày giao': 'ngayGiao',
            'người thực hiện': 'nguoiThucHien',
            'vị trí': 'viTri',
            'nhiệm vụ được giao': 'nhiemVu',
            'deadline': 'deadline',
            'trạng thái xử lý': 'trangThaiXuLy',
            'tiến độ': 'tienDo',
            'trưởng phòng check': 'truongPhongCheck',
            'check': 'truongPhongCheck',
            'ngày hoàn thành': 'ngayHoanThanh',
            'kết quả hoàn thành': 'ketQuaHoanThanh',

            // FB Message specific
            'lượt bắt đầu cuộc trò chuyện qua tin nhắn': 'messageStarts',
            'chi phí bắt đầu mỗi cuộc trò chuyện qua tin nhắn': 'costPerMessage',

            // Content Plan columns
            'mã nhân viên': 'maNhanVien',
            'tên nhân viên': 'tenNhanVien',
            'bộ phận/phòng/ban': 'phongBan',
            'loại content': 'loaiContent',
            'kênh': 'kenh',
            'đơn vị': 'donVi',
            'phê duyệt': 'pheDuyet',
            'tình trạng': 'tinhTrang',
            'tháng': 'thang',
        };

        const clean = header.toLowerCase().trim();
        return mapping[clean] || clean.replace(/\s+/g, '_');
    },

    /**
     * Parse number from Vietnamese format (1.000.000 or 1,000,000)
     */
    parseNumber(val) {
        if (typeof val === 'number') return val;
        if (!val || val === '') return 0;
        // Remove currency symbols, %, spaces
        let clean = String(val).replace(/[₫đ%x\s]/gi, '').trim();
        // Handle Vietnamese number format (dots as thousands separator)
        if (clean.includes('.') && clean.includes(',')) {
            // 1.000.000,50 → 1000000.50
            clean = clean.replace(/\./g, '').replace(',', '.');
        } else if ((clean.match(/\./g) || []).length > 1) {
            // 1.000.000 → 1000000
            clean = clean.replace(/\./g, '');
        } else if (clean.includes('.') && !clean.includes(',')) {
            // Single dot: check if it's thousands separator (e.g., "391.722" where after-dot is 3 digits)
            const dotParts = clean.split('.');
            if (dotParts[1] && dotParts[1].length === 3) {
                // 391.722 → 391722 (thousands separator, not decimal)
                clean = clean.replace('.', '');
            }
            // else: normal decimal like 3.14
        } else if (clean.includes(',') && !clean.includes('.')) {
            // 1,000,000 → 1000000 or 1,5 → 1.5
            const parts = clean.split(',');
            if (parts.length > 2 || (parts[1] && parts[1].length === 3)) {
                clean = clean.replace(/,/g, '');
            } else {
                clean = clean.replace(',', '.');
            }
        }
        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num;
    },

    /**
     * Get month number from Vietnamese month name
     */
    getMonthNumber(thang) {
        if (!thang) return 0;
        const match = String(thang).match(/(\d+)/);
        return match ? parseInt(match[1]) : 0;
    },

    /**
     * Try fetching from multiple URLs (different tab names) until one works
     */
    async fetchWithFallback(urls) {
        for (const url of urls) {
            const result = await this.fetchCSV(url);
            if (result && result.length > 0) return result;
        }
        return null;
    },

    /**
     * Load all data - tries server proxy first, then direct Sheet URLs, then demo data
     */
    async loadAll() {
        const data = {
            performance: null,
            fbAds: null,
            fbMessage: null,
            googleAds: null,
            tiktokAds: null,
            kpis: null,
            contentPlan: null,
            tasks: null,
            isDemo: true,
            liveSheets: []
        };

        // Key mapping: server key → client dataKey
        const keyMap = {
            'performance': 'performance',
            'fbConversion': 'fbAds',
            'fbMessage': 'fbMessage',
            'googleAds': 'googleAds',
            'tiktokAds': 'tiktokAds',
            'kpi': 'kpis',
            'contentPlan': 'contentPlan',
            'tasks': 'tasks',
        };

        // Try server-side proxy first (/api/data) — returns raw CSV text
        let proxyOk = false;
        try {
            const res = await fetch('/api/data');
            if (res.ok) {
                const proxyData = await res.json();
                let anyData = false;
                for (const [serverKey, clientKey] of Object.entries(keyMap)) {
                    const csvText = proxyData[serverKey];
                    if (csvText && csvText.trim()) {
                        const parsed = DataService.parseCSV(csvText);
                        if (parsed && parsed.length > 0) {
                            data[clientKey] = parsed;
                            data.liveSheets.push(serverKey);
                            anyData = true;
                            console.log(`✅ Loaded via proxy: ${serverKey} (${parsed.length} rows)`);
                        }
                    }
                }
                if (anyData) {
                    proxyOk = true;
                    data.isDemo = false;
                    console.log('✅ All data loaded via server proxy');
                    return data;
                }
            }
        } catch (e) {
            console.warn('ℹ️ Server proxy not available, trying direct fetch...');
        }

        // Fallback: direct Google Sheets fetch (client-side)
        await CONFIG.loadSheetsConfig();
        CONFIG.loadUrls();

        const keys = [
            { key: 'performance', dataKey: 'performance', demo: 'performance' },
            { key: 'fbConversion', dataKey: 'fbAds', demo: 'fbAds' },
            { key: 'fbMessage', dataKey: 'fbMessage', demo: 'fbAds' },
            { key: 'googleAds', dataKey: 'googleAds', demo: 'googleAds' },
            { key: 'tiktokAds', dataKey: 'tiktokAds', demo: 'tiktokAds' },
            { key: 'kpi', dataKey: 'kpis', demo: 'kpis' },
            { key: 'contentPlan', dataKey: 'contentPlan', demo: null },
            { key: 'tasks', dataKey: 'tasks', demo: 'tasks' },
        ];

        const results = await Promise.allSettled(
            keys.map(k => this.fetchWithFallback(CONFIG.getCsvUrls(k.key)))
        );

        let anyLive = false;
        results.forEach((result, i) => {
            const liveData = result.status === 'fulfilled' ? result.value : null;
            if (liveData && liveData.length > 0) {
                data[keys[i].dataKey] = liveData;
                data.liveSheets.push(keys[i].key);
                anyLive = true;
                console.log(`✅ Loaded live data: ${keys[i].key} (${liveData.length} rows)`);
            } else {
                data[keys[i].dataKey] = DEMO_DATA[keys[i].demo];
                console.log(`ℹ️ Using demo data: ${keys[i].key}`);
            }
        });

        data.isDemo = !anyLive;
        return data;
    }
};
