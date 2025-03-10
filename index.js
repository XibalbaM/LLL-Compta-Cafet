const { ipcRenderer } = require('electron')

// Store state
let products = [];
let stock = {};
let cart = [];

// DOM Elements
const stockSelect = document.getElementById('product-select');
const saleSelect = document.getElementById('sale-product-select');
const stockQuantity = document.getElementById('stock-quantity');
const saleQuantity = document.getElementById('sale-quantity');
const priceType = document.getElementById('price-type');
const stockTable = document.getElementById('stock-table');
const cartTable = document.getElementById('cart-table');
const cartTotal = document.getElementById('cart-total-amount');
const productId = document.getElementById('product-id');
const productName = document.getElementById('product-name');
const productPrice1 = document.getElementById('product-price1');
const productPrice2 = document.getElementById('product-price2');
const productsTable = document.getElementById('products-table');

// Tab functionality
document.querySelectorAll('.tab-btn').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        button.classList.add('active');
        document.getElementById(button.dataset.tab).classList.add('active');
    });
});

// Format price to French standard
function formatPrice(price) {
    return price.toFixed(2).replace('.', ',') + ' €';
}

// Load products from tarifs.json
async function loadProducts() {
    try {
        products = await ipcRenderer.invoke('get-tarifs')
        updateProductSelects()
        updateProductsTable()
        initializeStock()
    } catch (error) {
        console.error('Erreur de chargement des produits:', error)
        alert('Erreur de chargement des produits.')
    }
}

// Initialize stock with zero quantities
function initializeStock() {
    products.forEach(product => {
        if (!stock[product.id]) {
            stock[product.id] = 0;
        }
    });
    updateStockTable();
}

// Update product select elements
function updateProductSelects() {
    const selectElements = [stockSelect, saleSelect];
    selectElements.forEach(select => {
        select.innerHTML = '<option value="">Sélectionner un produit</option>';
        products.forEach(product => {
            const option = document.createElement('option');
            option.value = product.id;
            option.textContent = product.name;
            select.appendChild(option);
        });
    });
}

// Update stock table
function updateStockTable() {
    const tbody = stockTable.querySelector('tbody');
    tbody.innerHTML = '';
    products.forEach(product => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${product.name}</td>
            <td>${stock[product.id] || 0}</td>
            <td>${formatPrice(product.price1)}</td>
            <td>${formatPrice(product.price2)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Update stock
document.getElementById('update-stock').addEventListener('click', () => {
    const productId = stockSelect.value;
    const quantity = parseInt(stockQuantity.value);

    if (!productId || isNaN(quantity)) {
        alert('Veuillez sélectionner un produit et entrer une quantité valide');
        return;
    }

    stock[productId] = (stock[productId] || 0) + quantity;
    updateStockTable();
    saveData();
    stockSelect.value = '';
    stockQuantity.value = '';
});

// Update sales grid
function updateSalesGrid() {
    const salesGrid = document.querySelector('.sales-grid');
    salesGrid.innerHTML = '';
    
    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        
        const currentStock = stock[product.id] || 0;
        const isOutOfStock = currentStock <= 0;
        
        card.innerHTML = `
            <h4>${product.name}</h4>
            <div class="stock">Stock: ${currentStock}</div>
            <div class="price-buttons">
                <button class="price-button mdl-price" 
                        data-id="${product.id}" 
                        data-price="price1"
                        ${isOutOfStock ? 'disabled' : ''}>
                    MDL<br>${formatPrice(product.price1)}
                </button>
                <button class="price-button normal-price" 
                        data-id="${product.id}" 
                        data-price="price2"
                        ${isOutOfStock ? 'disabled' : ''}>
                    Normal<br>${formatPrice(product.price2)}
                </button>
            </div>
        `;
        
        salesGrid.appendChild(card);
    });
}

// Update cart table
function updateCartTable() {
    const tbody = cartTable.querySelector('tbody');
    tbody.innerHTML = '';
    let total = 0;

    cart.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.productName}</td>
            <td>${formatPrice(item.price)}</td>
            <td>
                <div class="quantity-control">
                    <button class="quantity-decrease" data-index="${index}">-</button>
                    ${item.quantity}
                    <button class="quantity-increase" data-index="${index}">+</button>
                </div>
            </td>
            <td>${item.priceType === 'price1' ? 'Prix MDL' : 'Prix Normal'}</td>
            <td>${formatPrice(item.total)}</td>
            <td><button class="delete-item" data-index="${index}">Supprimer</button></td>
        `;
        tbody.appendChild(tr);
        total += item.total;
    });

    cartTotal.textContent = formatPrice(total);
}

// Handle quantity changes
cartTable.addEventListener('click', (e) => {
    if (e.target.classList.contains('quantity-decrease') || 
        e.target.classList.contains('quantity-increase')) {
        const index = parseInt(e.target.dataset.index);
        const item = cart[index];
        const isIncrease = e.target.classList.contains('quantity-increase');
        
        if (isIncrease) {
            if ((stock[item.productId] || 0) > 0) {
                item.quantity++;
                stock[item.productId]--;
            } else {
                alert('Stock insuffisant');
                return;
            }
        } else {
            item.quantity--;
            stock[item.productId]++;
            if (item.quantity <= 0) {
                cart.splice(index, 1);
            }
        }
        
        if (item.quantity > 0) {
            item.total = item.price * item.quantity;
        }
        
        updateCartTable();
        updateSalesGrid();
    } else if (e.target.classList.contains('delete-item')) {
        const index = parseInt(e.target.dataset.index);
        const item = cart[index];
        stock[item.productId] += item.quantity;
        cart.splice(index, 1);
        updateCartTable();
        updateSalesGrid();
    }
});

// Handle product purchase buttons
document.querySelector('.sales-grid').addEventListener('click', (e) => {
    if (!e.target.classList.contains('price-button') || e.target.disabled) return;
    
    const productId = e.target.dataset.id;
    const priceType = e.target.dataset.price;
    const product = products.find(p => p.id === productId);
    
    if (!product || (stock[productId] || 0) <= 0) return;
    
    const price = priceType === 'price1' ? product.price1 : product.price2;
    const existingItem = cart.find(item => 
        item.productId === productId && item.priceType === priceType
    );
    
    if (existingItem) {
        existingItem.quantity++;
        existingItem.total = existingItem.price * existingItem.quantity;
    } else {
        cart.push({
            productId,
            productName: product.name,
            quantity: 1,
            priceType,
            price,
            total: price
        });
    }
    
    stock[productId]--;
    updateCartTable();
    updateSalesGrid();
});

// Complete sale
document.getElementById('complete-sale').addEventListener('click', () => {
    if (cart.length === 0) {
        alert('Le panier est vide');
        return;
    }

    // Update stock
    cart.forEach(item => {
        stock[item.productId] -= item.quantity;
    });

    // Clear cart
    cart = [];
    updateCartTable();
    updateStockTable();
    saveData();
    alert('Vente complétée avec succès!');
});

// Add these functions
function saveData() {
    ipcRenderer.send('save-data', { stock })
}

function loadData() {
    ipcRenderer.send('load-data')
}

// Add event listeners
ipcRenderer.on('save-complete', (event, message) => {
    alert(message)
})

ipcRenderer.on('load-complete', (event, data) => {
    stock = data
    updateStockTable()
})

// Save products to file
function saveProducts() {
    ipcRenderer.send('save-products', { products })
}

// Update products table
function updateProductsTable() {
    const tbody = productsTable.querySelector('tbody');
    tbody.innerHTML = '';
    products.forEach(product => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${product.id}</td>
            <td>${product.name}</td>
            <td>${formatPrice(product.price1)}</td>
            <td>${formatPrice(product.price2)}</td>
            <td>
                <button class="edit-product" data-id="${product.id}">Modifier</button>
                <button class="delete-product" data-id="${product.id}">Supprimer</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Add or update product
document.getElementById('add-product').addEventListener('click', () => {
    const id = productId.value.trim();
    const name = productName.value.trim();
    const price1 = parseFloat(productPrice1.value);
    const price2 = parseFloat(productPrice2.value);

    if (!id || !name || isNaN(price1) || isNaN(price2)) {
        alert('Veuillez remplir tous les champs correctement');
        return;
    }

    const existingIndex = products.findIndex(p => p.id === id);
    if (existingIndex !== -1) {
        // Update existing product
        products[existingIndex] = { id, name, price1, price2 };
    } else {
        // Add new product
        products.push({ id, name, price1, price2 });
    }

    saveProducts();
    updateProductsTable();
    updateProductSelects();
    updateStockTable();

    // Clear form
    productId.value = '';
    productName.value = '';
    productPrice1.value = '';
    productPrice2.value = '';
});

// Handle edit and delete buttons
productsTable.addEventListener('click', (e) => {
    const productId = e.target.dataset.id;
    if (!productId) return;

    if (e.target.classList.contains('edit-product')) {
        const product = products.find(p => p.id === productId);
        if (product) {
            // Fill form with product data
            document.getElementById('product-id').value = product.id;
            document.getElementById('product-name').value = product.name;
            document.getElementById('product-price1').value = product.price1;
            document.getElementById('product-price2').value = product.price2;
        }
    } else if (e.target.classList.contains('delete-product')) {
        if (confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
            products = products.filter(p => p.id !== productId);
            saveProducts();
            updateProductsTable();
            updateProductSelects();
            updateStockTable();
        }
    }
});

// Add event listeners for products saving
ipcRenderer.on('save-products-complete', (event, message) => {
    alert(message);
})

ipcRenderer.on('save-products-error', (event, message) => {
    alert(message);
})

// Load data when app starts
loadData();

// Initialize the application
loadProducts(); 