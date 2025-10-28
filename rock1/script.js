// Global Variables
let port = null;
let reader = null;
let isConnected = false;
let telemetryEnabled = false;
let csvLog = [];
let currentData = {
    TeamID: '',
    Latitude: 0,
    Longitude: 0,
    Altitude: 0,
    Pressure: 0,
    Temp: 0,
    Ax: 0, Ay: 0, Az: 0,
    Gx: 0, Gy: 0, Gz: 0,
    Vel: 0,
    State: 0,
    Servo: 0,
    Packet: 0,
    Time: ''
};
// Flight States
const flightStates = {
    0: { name: 'IDLE', color: '#6b7280', class: 'idle' }, // Added class for consistency
    1: { name: 'LAUNCH', color: '#eab308', class: 'launch' },
    2: { name: 'ASCENT', color: '#3b82f6', class: 'ascent' },
    3: { name: 'DESCENT', color: '#f97316', class: 'descent' },
    4: { name: 'RECOVERY', color: '#16a34a', class: 'recovery' }
};
// Chart.js Charts
let charts = {};
// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeUI();
    initializeCharts();
    setupEventListeners();
    checkSerialSupport();
});
// Check Web Serial API Support
function checkSerialSupport() {
    if ('serial' in navigator) {
        populatePortsList();
    } else {
        // Fallback for demo mode
        console.warn('Web Serial API not supported. Using Demo Mode for serial functionality.');
        populatePortsList(); // Still populate for a realistic UI
        // Note: The handleConnect will start demo mode if serial isn't found.
    }
}
// Populate COM Ports (Hardcoded list for UI demonstration)
function populatePortsList() {
    const portSelect = document.getElementById('portSelect');
    // Using a placeholder list since actual port discovery requires Web Serial API
    const ports = ['COM1', 'COM3', 'COM4', 'COM5', 'COM7', 'COM8']; 
    
    ports.forEach(portName => {
        const option = document.createElement('option');
        option.value = portName;
        option.textContent = portName;
        portSelect.appendChild(option);
    });
}
// Initialize UI
function initializeUI() {
    document.getElementById('noDataMessage').style.display = 'block';
    // Initial badge styles (optional, CSS handles this better)
    document.getElementById('stateBadge').style.backgroundColor = flightStates[0].color;
    document.getElementById('connectionStatus').classList.remove('active');
    document.getElementById('servoBadge').classList.remove('deployed');
}
// Initialize Charts (as provided)
function initializeCharts() {
    const chartConfig = {
        type: 'line',
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    ticks: { color: '#9ca3af', font: { size: 10 } },
                    grid: { color: 'rgba(75, 85, 99, 0.3)' }
                },
                y: {
                    ticks: { color: '#9ca3af', font: { size: 10 } },
                    grid: { color: 'rgba(75, 85, 99, 0.3)' }
                }
            }
        }
    };
    // Altitude Chart
    charts.altitude = new Chart(document.getElementById('altitudeChart'), {
        ...chartConfig,
        data: {
            labels: [],
            datasets: [{
                label: 'Altitude',
                data: [],
                borderColor: '#3b82f6',
                borderWidth: 2,
                pointRadius: 0
            }]
        }
    });
    // Pressure Chart
    charts.pressure = new Chart(document.getElementById('pressureChart'), {
        ...chartConfig,
        data: {
            labels: [],
            datasets: [{
                label: 'Pressure',
                data: [],
                borderColor: '#a855f7',
                borderWidth: 2,
                pointRadius: 0
            }]
        }
    });
    // Temperature Chart
    charts.temp = new Chart(document.getElementById('tempChart'), {
        ...chartConfig,
        data: {
            labels: [],
            datasets: [{
                label: 'Temperature',
                data: [],
                borderColor: '#ef4444',
                borderWidth: 2,
                pointRadius: 0
            }]
        }
    });
    // Velocity Chart
    charts.velocity = new Chart(document.getElementById('velocityChart'), {
        ...chartConfig,
        data: {
            labels: [],
            datasets: [{
                label: 'Velocity',
                data: [],
                borderColor: '#10b981',
                borderWidth: 2,
                pointRadius: 0
            }]
        }
    });
    // Acceleration Chart (3 lines)
    charts.accel = new Chart(document.getElementById('accelChart'), {
        ...chartConfig,
        options: {
            ...chartConfig.options,
            plugins: {
                legend: {
                    display: true,
                    labels: { color: '#9ca3af', font: { size: 10 } }
                }
            }
        },
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Ax',
                    data: [],
                    borderColor: '#ef4444',
                    borderWidth: 2,
                    pointRadius: 0
                },
                {
                    label: 'Ay',
                    data: [],
                    borderColor: '#3b82f6',
                    borderWidth: 2,
                    pointRadius: 0
                },
                {
                    label: 'Az',
                    data: [],
                    borderColor: '#10b981',
                    borderWidth: 2,
                    pointRadius: 0
                }
            ]
        }
    });
    // Gyroscope Chart (3 lines)
    charts.gyro = new Chart(document.getElementById('gyroChart'), {
        ...chartConfig,
        options: {
            ...chartConfig.options,
            plugins: {
                legend: {
                    display: true,
                    labels: { color: '#9ca3af', font: { size: 10 } }
                }
            }
        },
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Gx',
                    data: [],
                    borderColor: '#f59e0b',
                    borderWidth: 2,
                    pointRadius: 0
                },
                {
                    label: 'Gy',
                    data: [],
                    borderColor: '#8b5cf6',
                    borderWidth: 2,
                    pointRadius: 0
                },
                {
                    label: 'Gz',
                    data: [],
                    borderColor: '#ec4899',
                    borderWidth: 2,
                    pointRadius: 0
                }
            ]
        }
    });
}
// Setup Event Listeners (as provided)
function setupEventListeners() {
    document.getElementById('connectBtn').addEventListener('click', handleConnect);
    document.getElementById('telemetryBtn').addEventListener('click', handleEnableTelemetry);
    document.getElementById('zeroSetBtn').addEventListener('click', handleZeroSet);
    document.getElementById('downloadBtn').addEventListener('click', downloadCSV);
}
// Handle Connection
async function handleConnect() {
    const portSelect = document.getElementById('portSelect');
    const baudRate = document.getElementById('baudRate').value;
    const connectBtn = document.getElementById('connectBtn');
    
    // Fallback to demo mode if serial is not supported
    const isSerialSupported = 'serial' in navigator;

    if (!isSerialSupported && !isConnected) {
        // Start Demo Mode
        startDemoMode();
        isConnected = true;
        connectBtn.textContent = 'Disconnect (Demo)';
        connectBtn.classList.add('connected');
        document.getElementById('telemetryBtn').disabled = false;
        document.getElementById('connectionStatus').textContent = 'DEMO CONNECTED';
        document.getElementById('connectionStatus').classList.add('active');
        portSelect.disabled = true;
        document.getElementById('baudRate').disabled = true;
        return; // Exit here for demo mode
    }

    if (!portSelect.value && isSerialSupported) {
        alert('Please select a COM port');
        return;
    }
    
    try {
        if (!isConnected) {
            // Connect
            port = await navigator.serial.requestPort();
            await port.open({ baudRate: parseInt(baudRate) });
            startReading();
            
            isConnected = true;
            connectBtn.textContent = 'Disconnect';
            connectBtn.classList.add('connected');
            document.getElementById('telemetryBtn').disabled = false;
            document.getElementById('connectionStatus').textContent = 'CONNECTED';
            document.getElementById('connectionStatus').classList.add('active');
            portSelect.disabled = true;
            document.getElementById('baudRate').disabled = true;
        } else {
            // Disconnect (Handles both serial and demo disconnection)
            if (reader) {
                await reader.cancel();
                reader = null;
            }
            if (port) {
                await port.close();
                port = null;
            }
            isConnected = false;
            telemetryEnabled = false;
            connectBtn.textContent = 'Connect';
            connectBtn.classList.remove('connected');
            document.getElementById('telemetryBtn').disabled = true;
            document.getElementById('telemetryBtn').classList.remove('active');
            document.getElementById('telemetryBtn').textContent = 'Enable Telemetry';
            document.getElementById('connectionStatus').textContent = 'DISCONNECTED';
            document.getElementById('connectionStatus').classList.remove('active');
            document.getElementById('zeroSetBtn').disabled = true;
            portSelect.disabled = false;
            document.getElementById('baudRate').disabled = false;
        }
    } catch (error) {
        console.error('Connection error:', error);
        alert('Failed to connect: ' + error.message);
    }
}
// Start Reading Serial Data
async function startReading() {
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
    reader = textDecoder.readable.getReader();
    let buffer = '';
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += value;
            const lines = buffer.split('\n');
            buffer = lines.pop();
            for (const line of lines) {
                if (line.trim()) {
                    parseCSVData(line.trim());
                }
            }
        }
    } catch (error) {
        if (error.name !== 'BreakError') { // Ignore expected errors on cancel()
            console.error('Read error:', error);
        }
    }
}
// Demo Mode (Simulated Data)
let demoInterval;
let demoPacketCount = 0;
function startDemoMode() {
    if (demoInterval) clearInterval(demoInterval);

    demoInterval = setInterval(() => {
        if (!telemetryEnabled) return;
        demoPacketCount++;
        const time = new Date().toLocaleTimeString('en-US', { hour12: false });
        
        // Simulating a more realistic state change over time
        let state;
        if (demoPacketCount < 10) state = 0; // IDLE
        else if (demoPacketCount < 20) state = 1; // LAUNCH
        else if (demoPacketCount < 100) state = 2; // ASCENT
        else if (demoPacketCount < 150) state = 3; // DESCENT
        else state = 4; // RECOVERY

        // Simulating altitude and velocity based on state
        let altitude, velocity;
        if (state === 2) { // ASCENT
            altitude = 500 + demoPacketCount * 50 + (Math.random() * 10 - 5);
            velocity = 100 + Math.random() * 50;
        } else if (state === 3) { // DESCENT
            altitude = 5000 - (demoPacketCount - 100) * 30 + (Math.random() * 10 - 5);
            velocity = 30 + Math.random() * 10;
        } else if (state === 4) { // RECOVERY (Landed)
            altitude = Math.random() * 10;
            velocity = Math.random() * 2;
        } else { // IDLE/LAUNCH
            altitude = Math.random() * 50;
            velocity = Math.random() * 5;
        }

        const simulatedLine = `TEAM01,${(17.385 + Math.random() * 0.01).toFixed(6)},${(78.486 + Math.random() * 0.01).toFixed(6)},${altitude.toFixed(2)},${(101000 + Math.random() * 1000).toFixed(2)},${(20 + Math.random() * 10).toFixed(2)},${(Math.random() * 2 - 1).toFixed(3)},${(Math.random() * 2 - 1).toFixed(3)},${(9.8 + Math.random() * 0.5).toFixed(3)},${(Math.random() * 0.2 - 0.1).toFixed(3)},${(Math.random() * 0.2 - 0.1).toFixed(3)},${(Math.random() * 0.2 - 0.1).toFixed(3)},${velocity.toFixed(2)},${state},${state === 4 ? 0 : 1},${demoPacketCount}`;
        
        parseCSVData(simulatedLine);
    }, 500); // 2Hz update rate
}
// Parse CSV Data (as provided, minor time format change)
function parseCSVData(line) {
    if (!telemetryEnabled) return;
    const values = line.split(',');
    if (values.length < 16) return;
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    
    currentData = {
        TeamID: values[0],
        Latitude: parseFloat(values[1]) || 0,
        Longitude: parseFloat(values[2]) || 0,
        Altitude: parseFloat(values[3]) || 0,
        Pressure: parseFloat(values[4]) || 0,
        Temp: parseFloat(values[5]) || 0,
        Ax: parseFloat(values[6]) || 0,
        Ay: parseFloat(values[7]) || 0,
        Az: parseFloat(values[8]) || 0,
        Gx: parseFloat(values[9]) || 0,
        Gy: parseFloat(values[10]) || 0,
        Gz: parseFloat(values[11]) || 0,
        Vel: parseFloat(values[12]) || 0,
        State: parseInt(values[13]) || 0,
        Servo: parseInt(values[14]) || 0,
        Packet: parseInt(values[15]) || 0,
        Time: time
    };
    updateUI();
    updateCharts();
    logData();
}
// Update UI (as provided, minor servo logic fix based on common convention)
function updateUI() {
    // Status Bar
    document.getElementById('timeValue').textContent = currentData.Time;
    document.getElementById('packetValue').textContent = currentData.Packet;
    // Flight State
    const stateBadge = document.getElementById('stateBadge');
    const stateInfo = flightStates[currentData.State] || flightStates[0]; // Fallback to IDLE
    stateBadge.textContent = stateInfo.name;
    stateBadge.className = 'status-badge ' + stateInfo.class; // Apply dynamic class
    stateBadge.style.backgroundColor = stateInfo.color; // Set background color directly
    
    // Update Timeline
    document.querySelectorAll('.timeline-item').forEach(item => {
        item.classList.remove('active');
        if (parseInt(item.dataset.state) === currentData.State) {
            item.classList.add('active');
        }
    });
    // Servo Status (Assumed 0 = Deployed, 1 = Not Deployed - Adjusted logic for style)
    const servoBadge = document.getElementById('servoBadge');
    if (currentData.Servo === 0) {
        servoBadge.textContent = 'DEPLOYED';
        servoBadge.classList.add('deployed');
        servoBadge.classList.remove('not-deployed'); // Ensure style removal
    } else {
        servoBadge.textContent = 'NOT DEPLOYED';
        servoBadge.classList.remove('deployed');
        servoBadge.classList.add('not-deployed'); // Ensure style addition
    }
    // Current Values
    document.getElementById('altValue').textContent = currentData.Altitude.toFixed(2) + ' m';
    document.getElementById('pressValue').textContent = currentData.Pressure.toFixed(2) + ' Pa';
    document.getElementById('tempValue').textContent = currentData.Temp.toFixed(2) + ' °C';
    document.getElementById('velValue').textContent = currentData.Vel.toFixed(2) + ' m/s';
    document.getElementById('axValue').textContent = currentData.Ax.toFixed(2);
    document.getElementById('ayValue').textContent = currentData.Ay.toFixed(2);
    document.getElementById('azValue').textContent = currentData.Az.toFixed(2);
    document.getElementById('gxValue').textContent = currentData.Gx.toFixed(2);
    document.getElementById('gyValue').textContent = currentData.Gy.toFixed(2);
    document.getElementById('gzValue').textContent = currentData.Gz.toFixed(2);
    // GPS
    document.getElementById('latValue').textContent = currentData.Latitude.toFixed(6) + '°';
    document.getElementById('lonValue').textContent = currentData.Longitude.toFixed(6) + '°';
}
// Update Charts (as provided)
function updateCharts() {
    const maxPoints = 50;
    const time = currentData.Time;
    // Helper function to update a single chart
    const updateSingleChart = (chart, dataKey, dataValue) => {
        chart.data.labels.push(time);
        chart.data.datasets[0].data.push(dataValue);
        if (chart.data.labels.length > maxPoints) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
        }
        chart.update('none');
    };
    // Altitude
    updateSingleChart(charts.altitude, 'Altitude', currentData.Altitude);
    // Pressure
    updateSingleChart(charts.pressure, 'Pressure', currentData.Pressure);
    // Temperature
    updateSingleChart(charts.temp, 'Temp', currentData.Temp);
    // Velocity
    updateSingleChart(charts.velocity, 'Vel', currentData.Vel);
    
    // Acceleration (Ax, Ay, Az)
    charts.accel.data.labels.push(time);
    charts.accel.data.datasets[0].data.push(currentData.Ax);
    charts.accel.data.datasets[1].data.push(currentData.Ay);
    charts.accel.data.datasets[2].data.push(currentData.Az);
    if (charts.accel.data.labels.length > maxPoints) {
        charts.accel.data.labels.shift();
        charts.accel.data.datasets.forEach(dataset => dataset.data.shift());
    }
    charts.accel.update('none');
    
    // Gyroscope (Gx, Gy, Gz)
    charts.gyro.data.labels.push(time);
    charts.gyro.data.datasets[0].data.push(currentData.Gx);
    charts.gyro.data.datasets[1].data.push(currentData.Gy);
    charts.gyro.data.datasets[2].data.push(currentData.Gz);
    if (charts.gyro.data.labels.length > maxPoints) {
        charts.gyro.data.labels.shift();
        charts.gyro.data.datasets.forEach(dataset => dataset.data.shift());
    }
    charts.gyro.update('none');
}
// Log Data to Table (as provided)
function logData() {
    csvLog.push({ ...currentData });
    const logBody = document.getElementById('logBody');
    const noDataMessage = document.getElementById('noDataMessage');
    if (csvLog.length === 1) {
        noDataMessage.style.display = 'none';
        document.getElementById('downloadBtn').disabled = false;
    }
    // Add row to beginning of table
    const row = document.createElement('tr');
    const stateInfo = flightStates[currentData.State] || flightStates[0];
    
    row.innerHTML = `
        <td>${currentData.Packet}</td>
        <td style="font-family: monospace;">${currentData.Time}</td>
        <td>${currentData.Altitude.toFixed(1)}</td>
        <td>
            <span class="log-state" style="background: ${stateInfo.color};">
                ${stateInfo.name}
            </span>
        </td>
    `;
    logBody.insertBefore(row, logBody.firstChild);
    // Keep only last 100 rows
    while (logBody.children.length > 100) {
        logBody.removeChild(logBody.lastChild);
    }
    // Update count
    document.getElementById('logCount').textContent = csvLog.length;
}
// Enable Telemetry
async function handleEnableTelemetry() {
    if (!isConnected) {
        alert('Not connected to COM port');
        return;
    }
    // Only send command if not in demo mode
    if ('serial' in navigator && port) {
        await sendCommand('START_TELEMETRY');
    }
    
    telemetryEnabled = true;
    const telemetryBtn = document.getElementById('telemetryBtn');
    telemetryBtn.textContent = 'Telemetry Active';
    telemetryBtn.classList.add('active');
    telemetryBtn.disabled = true;
    document.getElementById('zeroSetBtn').disabled = false;
    document.getElementById('connectionStatus').textContent = 'ACTIVE';
}
// Zero-Set Sensors
async function handleZeroSet() {
    if (!isConnected) {
        alert('Not connected to COM port');
        return;
    }
    // Only send command if not in demo mode
    if ('serial' in navigator && port) {
        await sendCommand('ZERO_SET');
        alert('Zero-set command sent to rocket');
    } else {
        console.log('Demo mode - Command: ZERO_SET');
        alert('Zero-set command simulated (Demo Mode)');
    }
}
// Send Command to Rocket
async function sendCommand(command) {
    if (!port || !isConnected) {
        console.log('Command failed: Port not open or not connected.');
        return;
    }
    try {
        const writer = port.writable.getWriter();
        const encoder = new TextEncoder();
        await writer.write(encoder.encode(command + '\n'));
        writer.releaseLock();
        console.log('Command sent:', command);
    } catch (error) {
        console.error('Write error:', error);
        alert('Failed to send command: ' + error.message);
    }
}
// Download CSV (as provided)
function downloadCSV() {
    if (csvLog.length === 0) {
        alert('No data to download');
        return;
    }
    let csvContent = 'TeamID,Latitude,Longitude,Altitude,Pressure,Temp,Ax,Ay,Az,Gx,Gy,Gz,Vel,State,Servo,Packet,Time\n';
    
    csvLog.forEach(row => {
        csvContent += `${row.TeamID},${row.Latitude},${row.Longitude},${row.Altitude},${row.Pressure},${row.Temp},${row.Ax},${row.Ay},${row.Az},${row.Gx},${row.Gy},${row.Gz},${row.Vel},${row.State},${row.Servo},${row.Packet},${row.Time}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telemetry_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    alert('CSV file downloaded successfully!');
}