// ============================================
// DigiDash - Chart Manager
// Chart.js configurations for all charts
// ============================================

const ChartManager = {
    charts: {},

    // Color palette
    colors: {
        blue: { bg: 'rgba(99, 102, 241, 0.15)', border: '#6366f1' },
        purple: { bg: 'rgba(168, 85, 247, 0.15)', border: '#a855f7' },
        pink: { bg: 'rgba(236, 72, 153, 0.15)', border: '#ec4899' },
        green: { bg: 'rgba(34, 197, 94, 0.15)', border: '#22c55e' },
        orange: { bg: 'rgba(249, 115, 22, 0.15)', border: '#f97316' },
        cyan: { bg: 'rgba(6, 182, 212, 0.15)', border: '#06b6d4' },
        yellow: { bg: 'rgba(234, 179, 8, 0.15)', border: '#eab308' },
        red: { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444' },
    },

    // Shared chart defaults
    defaults: {
        font: { family: "'Inter', sans-serif" },
        color: '#6b7280',
        borderColor: 'rgba(0, 0, 0, 0.06)',
    },

    /**
     * Initialize Chart.js global defaults
     */
    init() {
        Chart.defaults.font.family = this.defaults.font.family;
        Chart.defaults.color = this.defaults.color;
        Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(30, 30, 50, 0.92)';
        Chart.defaults.plugins.tooltip.titleFont = { size: 13, weight: '600' };
        Chart.defaults.plugins.tooltip.bodyFont = { size: 12 };
        Chart.defaults.plugins.tooltip.padding = 12;
        Chart.defaults.plugins.tooltip.cornerRadius = 8;
        Chart.defaults.plugins.tooltip.borderColor = 'rgba(99, 102, 241, 0.2)';
        Chart.defaults.plugins.tooltip.borderWidth = 1;
        Chart.defaults.plugins.legend.labels.usePointStyle = true;
        Chart.defaults.plugins.legend.labels.pointStyle = 'circle';
        Chart.defaults.plugins.legend.labels.padding = 16;
    },

    /**
     * Destroy a chart if it exists (for re-render)
     */
    destroy(id) {
        if (this.charts[id]) {
            this.charts[id].destroy();
            delete this.charts[id];
        }
    },

    /**
     * Format number to Vietnamese currency
     */
    formatCurrency(val) {
        if (val >= 1e9) return (val / 1e9).toFixed(1) + 'B';
        if (val >= 1e6) return (val / 1e6).toFixed(1) + 'M';
        if (val >= 1e3) return (val / 1e3).toFixed(0) + 'K';
        return val.toLocaleString('vi-VN');
    },

    /**
     * Overview: Spending & Revenue trend (Line chart)
     */
    createTrendChart(canvasId, labels, spendingData, revenueData) {
        this.destroy(canvasId);
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Chi tiêu',
                        data: spendingData,
                        borderColor: this.colors.blue.border,
                        backgroundColor: this.colors.blue.bg,
                        borderWidth: 2.5,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointHoverRadius: 7,
                        pointBackgroundColor: this.colors.blue.border,
                    },
                    {
                        label: 'Doanh số',
                        data: revenueData,
                        borderColor: this.colors.green.border,
                        backgroundColor: this.colors.green.bg,
                        borderWidth: 2.5,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointHoverRadius: 7,
                        pointBackgroundColor: this.colors.green.border,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { intersect: false, mode: 'index' },
                scales: {
                    x: {
                        grid: { color: this.defaults.borderColor, drawBorder: false },
                        ticks: { font: { size: 11 } }
                    },
                    y: {
                        grid: { color: this.defaults.borderColor, drawBorder: false },
                        ticks: {
                            font: { size: 11 },
                            callback: (val) => this.formatCurrency(val)
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString('vi-VN')}₫`
                        }
                    }
                }
            }
        });
    },

    /**
     * Overview: Budget allocation (Doughnut)
     */
    createBudgetDoughnut(canvasId, labels, data) {
        this.destroy(canvasId);
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        const colorKeys = ['blue', 'green', 'orange', 'pink', 'purple', 'cyan'];
        const bgColors = colorKeys.map(k => this.colors[k].border);
        const hoverColors = colorKeys.map(k => this.colors[k].border + 'cc');

        this.charts[canvasId] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: bgColors.slice(0, labels.length),
                    hoverBackgroundColor: hoverColors.slice(0, labels.length),
                    borderWidth: 0,
                    spacing: 3,
                    borderRadius: 4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { font: { size: 11 }, padding: 12 }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = ((ctx.parsed / total) * 100).toFixed(1);
                                return `${ctx.label}: ${ctx.parsed.toLocaleString('vi-VN')}₫ (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    },

    /**
     * Overview: Channel performance (Grouped Bar)
     */
    createChannelBar(canvasId, labels, spendingData, ordersData) {
        this.destroy(canvasId);
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        this.charts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Chi tiêu',
                        data: spendingData,
                        backgroundColor: this.colors.blue.border + '99',
                        hoverBackgroundColor: this.colors.blue.border,
                        borderRadius: 6,
                        borderSkipped: false,
                        yAxisID: 'y',
                    },
                    {
                        label: 'Đơn hàng',
                        data: ordersData,
                        backgroundColor: this.colors.orange.border + '99',
                        hoverBackgroundColor: this.colors.orange.border,
                        borderRadius: 6,
                        borderSkipped: false,
                        yAxisID: 'y1',
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { intersect: false, mode: 'index' },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 11 } }
                    },
                    y: {
                        position: 'left',
                        grid: { color: this.defaults.borderColor, drawBorder: false },
                        ticks: {
                            font: { size: 11 },
                            callback: (val) => this.formatCurrency(val)
                        },
                        title: { display: true, text: 'Chi tiêu (₫)', font: { size: 11 } }
                    },
                    y1: {
                        position: 'right',
                        grid: { display: false },
                        ticks: { font: { size: 11 } },
                        title: { display: true, text: 'Đơn hàng', font: { size: 11 } }
                    }
                }
            }
        });
    },

    /**
     * Orders doughnut by channel
     */
    createOrdersDoughnut(canvasId, labels, data) {
        this.destroy(canvasId);
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        const bgColors = [this.colors.blue.border, this.colors.green.border, this.colors.pink.border, this.colors.orange.border];

        this.charts[canvasId] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: bgColors.slice(0, labels.length),
                    borderWidth: 0,
                    spacing: 3,
                    borderRadius: 4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { font: { size: 11 }, padding: 12 }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = ((ctx.parsed / total) * 100).toFixed(1);
                                return `${ctx.label}: ${ctx.parsed.toLocaleString('vi-VN')} đơn (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    },

    /**
     * Platform-specific trend chart (FB/Google/TikTok)
     */
    createPlatformTrend(canvasId, labels, datasets) {
        this.destroy(canvasId);
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        const colorList = ['blue', 'green', 'orange', 'pink', 'cyan'];
        const chartDatasets = datasets.map((ds, i) => ({
            label: ds.label,
            data: ds.data,
            borderColor: this.colors[colorList[i % colorList.length]].border,
            backgroundColor: this.colors[colorList[i % colorList.length]].bg,
            borderWidth: 2.5,
            fill: i === 0,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 7,
            pointBackgroundColor: this.colors[colorList[i % colorList.length]].border,
            yAxisID: ds.yAxisID || 'y',
        }));

        const options = {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            scales: {
                x: {
                    grid: { color: this.defaults.borderColor, drawBorder: false },
                    ticks: { font: { size: 11 } }
                },
                y: {
                    position: 'left',
                    grid: { color: this.defaults.borderColor, drawBorder: false },
                    ticks: {
                        font: { size: 11 },
                        callback: (val) => this.formatCurrency(val)
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString('vi-VN')}`
                    }
                }
            }
        };

        // Add secondary Y axis if any dataset uses it
        if (datasets.some(ds => ds.yAxisID === 'y1')) {
            options.scales.y1 = {
                position: 'right',
                grid: { display: false },
                ticks: { font: { size: 11 } }
            };
        }

        this.charts[canvasId] = new Chart(ctx, { type: 'line', data: { labels, datasets: chartDatasets }, options });
    },

    /**
     * KPI horizontal bar chart
     */
    createKPIChart(canvasId, labels, data) {
        this.destroy(canvasId);
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        const bgColors = data.map(val => {
            if (val >= 100) return this.colors.green.border + '99';
            if (val >= 80) return this.colors.yellow.border + '99';
            return this.colors.red.border + '99';
        });

        this.charts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Tiến độ (%)',
                    data,
                    backgroundColor: bgColors,
                    borderRadius: 6,
                    borderSkipped: false,
                    barThickness: 24,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                scales: {
                    x: {
                        grid: { color: this.defaults.borderColor, drawBorder: false },
                        ticks: { font: { size: 11 }, callback: v => v + '%' },
                        max: 120
                    },
                    y: {
                        grid: { display: false },
                        ticks: { font: { size: 11 } }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `Tiến độ: ${ctx.parsed.x}%`
                        }
                    }
                }
            }
        });
    },

    /**
     * Tasks status doughnut
     */
    createTasksChart(canvasId, statusCounts) {
        this.destroy(canvasId);
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        const labels = Object.keys(statusCounts);
        const data = Object.values(statusCounts);
        const colorMap = {
            'Hoàn thành': this.colors.green.border,
            'Done': this.colors.green.border,
            'Đang làm': this.colors.blue.border,
            'In Progress': this.colors.blue.border,
            'Quá hạn': this.colors.red.border,
            'Overdue': this.colors.red.border,
            'Chờ': this.colors.yellow.border,
            'Pending': this.colors.yellow.border,
            'Đúng hạn': this.colors.green.border,
        };
        const bgColors = labels.map(l => colorMap[l] || this.colors.purple.border);

        this.charts[canvasId] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: bgColors,
                    borderWidth: 0,
                    spacing: 3,
                    borderRadius: 4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { font: { size: 12 }, padding: 14 }
                    }
                }
            }
        });
    },

    /**
     * Draw a half-circle gauge chart on a canvas
     * @param {string} canvasId - Canvas element ID
     * @param {number} value - Percentage (0-100)
     * @param {string} color1 - Primary fill color
     * @param {string} color2 - Secondary fill color (gradient end)
     */
    drawGauge(canvasId, value, color1 = '#22c55e', color2 = '#eab308') {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const cx = w / 2;
        const cy = h - 10;
        const radius = Math.min(cx - 10, cy - 10);

        ctx.clearRect(0, 0, w, h);

        // Background arc (gray)
        ctx.beginPath();
        ctx.arc(cx, cy, radius, Math.PI, 2 * Math.PI, false);
        ctx.lineWidth = 18;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.lineCap = 'round';
        ctx.stroke();

        // Value arc
        const pct = Math.min(value / 100, 1);
        const endAngle = Math.PI + pct * Math.PI;
        const gradient = ctx.createLinearGradient(cx - radius, cy, cx + radius, cy);
        gradient.addColorStop(0, color1);
        gradient.addColorStop(0.7, color2);
        gradient.addColorStop(1, '#ef4444');

        ctx.beginPath();
        ctx.arc(cx, cy, radius, Math.PI, endAngle, false);
        ctx.lineWidth = 18;
        ctx.strokeStyle = pct >= 0.9 ? color1 : gradient;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Needle tick mark at current value
        const needleAngle = Math.PI + pct * Math.PI;
        const needleLen = radius - 20;
        const nx = cx + Math.cos(needleAngle) * needleLen;
        const ny = cy + Math.sin(needleAngle) * needleLen;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(nx, ny);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#374151';
        ctx.stroke();

        // Center dot
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#374151';
        ctx.fill();
    },

    /**
     * Bar chart: Per-person quality/ontime rate
     */
    createTaskPersonBar(canvasId, labels, data, label, color) {
        this.destroy(canvasId);
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        this.charts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label,
                    data,
                    backgroundColor: color + '99',
                    hoverBackgroundColor: color,
                    borderRadius: 6,
                    borderSkipped: false,
                    barThickness: 32,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 11 } }
                    },
                    y: {
                        grid: { color: this.defaults.borderColor, drawBorder: false },
                        ticks: { font: { size: 11 }, callback: v => v + '%' },
                        max: 100,
                        min: 0,
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${label}: ${ctx.parsed.y.toFixed(1)}%`
                        }
                    },
                    datalabels: undefined
                }
            },
            plugins: [{
                afterDatasetsDraw: (chart) => {
                    const ctx2 = chart.ctx;
                    chart.data.datasets.forEach((dataset, i) => {
                        const meta = chart.getDatasetMeta(i);
                        meta.data.forEach((bar, index) => {
                            const val = dataset.data[index];
                            ctx2.save();
                            ctx2.fillStyle = '#fff';
                            ctx2.font = 'bold 11px Inter';
                            ctx2.textAlign = 'center';
                            ctx2.textBaseline = 'bottom';
                            ctx2.fillText(val.toFixed(1) + '%', bar.x, bar.y - 4);
                            ctx2.restore();
                        });
                    });
                }
            }]
        });
    }
};
