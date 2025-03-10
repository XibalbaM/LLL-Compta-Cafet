const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

// Get the user data path
const userDataPath = app.getPath('userData')

// Ensure the data directory exists
if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath)
}

// Define paths for data files
const stockFilePath = path.join(userDataPath, 'stock.json')
const tarifsFilePath = path.join(userDataPath, 'tarifs.json')

// Copy tarifs.json to user data directory if it doesn't exist
if (!fs.existsSync(tarifsFilePath)) {
    const defaultTarifs = fs.readFileSync(path.join(__dirname, 'tarifs.json'))
    fs.writeFileSync(tarifsFilePath, defaultTarifs)
}

function createWindow () {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    })

    win.setMenu(null)
    win.loadFile('index.html')
}

// Save data handler
ipcMain.on('save-data', (event, data) => {
    fs.writeFileSync(stockFilePath, JSON.stringify(data.stock))
    event.reply('save-complete', 'Données sauvegardées avec succès!')
})

// Load data handler
ipcMain.on('load-data', (event) => {
    try {
        const stockData = fs.existsSync(stockFilePath) 
            ? fs.readFileSync(stockFilePath, 'utf8')
            : '{}'
        event.reply('load-complete', JSON.parse(stockData))
    } catch (error) {
        event.reply('load-complete', {})
    }
})

// Save products handler
ipcMain.on('save-products', (event, data) => {
    try {
        fs.writeFileSync(tarifsFilePath, JSON.stringify(data.products, null, 4))
        event.reply('save-products-complete', 'Produits sauvegardés avec succès!')
    } catch (error) {
        event.reply('save-products-error', 'Erreur lors de la sauvegarde des produits')
    }
})

// Add this to handle tarifs.json loading in renderer
ipcMain.handle('get-tarifs', async () => {
    try {
        const data = await fs.promises.readFile(tarifsFilePath, 'utf8')
        return JSON.parse(data)
    } catch (error) {
        console.error('Error reading tarifs:', error)
        return []
    }
})

app.whenReady().then(createWindow) 