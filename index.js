const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();

// Middleware
app.use(cors({
    origin: [
        'https://feastflow-frontend.onrender.com',
        'http://localhost:3000'  // Keep this for local development
    ],
    credentials: true
}));
app.use(express.json());

// Database configuration
const pool = new Pool({
    user: 'canteen_user',
    host: 'dpg-ctb53d23esus739enoi0-a.oregon-postgres.render.com',
    database: 'canteen_ordering_system_v2wm',
    password: 'IcFZzRE06ZOIKscHu0twuleg9i3VAkX1',
    port: 5432,
    ssl: true
});

// USER ENDPOINTS
// Register new user
app.post('/create_new_user_info', async (req, res) => {
    try {
        const { username, email, password, dietary_restrictions, allergies } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const result = await pool.query(
            'INSERT INTO "users" (username, email, password, dietary_restrictions, allergies, loyalty_points) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [username, email, hashedPassword, dietary_restrictions, allergies, 0]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all users
app.get('/get_all_user_info', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM "users"');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Login
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await pool.query('SELECT * FROM "users" WHERE email = $1', [email]);
        
        if (user.rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }

        const validPassword = await bcrypt.compare(password, user.rows[0].password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        const token = jwt.sign({ userId: user.rows[0].id }, 'your_jwt_secret');
        res.json({ token, user: user.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get specific user profile
app.get('/user_info/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM "users" WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching user info:', err);
        res.status(500).json({ error: 'Failed to fetch user info' });
    }
});

// Update user profile
app.put('/update_user_info', async (req, res) => {
    try {
        const { id, username, email, dietary_restrictions, allergies } = req.body;
        const result = await pool.query(
            'UPDATE "users" SET username = $1, email = $2, dietary_restrictions = $3, allergies = $4 WHERE id = $5 RETURNING *',
            [username, email, dietary_restrictions, allergies, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update user info
app.put('/update_user_info/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { username, email, dietary_restrictions, allergies, loyalty_points } = req.body;
        
        const result = await pool.query(
            'UPDATE "users" SET username = $1, email = $2, dietary_restrictions = $3, allergies = $4, loyalty_points = $5 WHERE id = $6 RETURNING *',
            [username, email, dietary_restrictions, allergies, loyalty_points, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating user info:', err);
        res.status(500).json({ error: 'Failed to update user info' });
    }
});

// MENU ENDPOINTS
app.get('/menu_items', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM "MenuItems"');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching menu items:', err);
        res.status(500).json({ error: 'Failed to fetch menu items' });
    }
});

app.get('/menu_items/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const result = await pool.query('SELECT * FROM "MenuItems" WHERE category = $1', [category]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ORDER ENDPOINTS
app.post('/orders', async (req, res) => {
    try {
        const { user_id, items, total_price } = req.body;
        const order = await pool.query(
            'INSERT INTO "Orders" (user_id, status, loyalty_points, created_at, total_price, order_number) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [user_id, 'pending', 0, new Date(), total_price, `ORD-${Date.now()}`]
        );

        for (let item of items) {
            await pool.query(
                'INSERT INTO "OrderItems" (order_id, name, price, quantity, customizations) VALUES ($1, $2, $3, $4, $5)',
                [order.rows[0].id, item.name, item.price, item.quantity, item.customizations]
            );
        }

        res.json(order.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/orders/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await pool.query('SELECT * FROM "Orders" WHERE user_id = $1', [userId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/orders/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const result = await pool.query(
            'UPDATE "Orders" SET status = $1 WHERE id = $2 RETURNING *',
            [status, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const order = await pool.query('SELECT * FROM "Orders" WHERE id = $1', [id]);
        const items = await pool.query('SELECT * FROM "OrderItems" WHERE order_id = $1', [id]);
        res.json({ ...order.rows[0], items: items.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CART ENDPOINTS
// Note: You might want to create a Cart table in your database
app.post('/cart/add', async (req, res) => {
    try {
        const { user_id, item_id, quantity, customizations } = req.body;
        // Implement cart logic here
        res.json({ message: "Item added to cart" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/cart/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        // Implement get cart logic here
        res.json({ items: [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/cart/update', async (req, res) => {
    try {
        const { item_id, quantity } = req.body;
        // Implement update cart logic here
        res.json({ message: "Cart updated" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/cart/:itemId', async (req, res) => {
    try {
        const { itemId } = req.params;
        // Implement delete cart item logic here
        res.json({ message: "Item removed from cart" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete user endpoint
app.delete('/delete_user/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM "users" WHERE id = $1 RETURNING *', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ message: `User ${id} deleted successfully` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add menu item endpoint
app.post('/add_menu_item', async (req, res) => {
    try {
        const { name, price, category, nutritional_info, custumization_options, image_url, description } = req.body;
        const result = await pool.query(
            'INSERT INTO "MenuItems" (name, price, category, nutritional_info, custumization_options, image_url, description) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [name, price, category, nutritional_info, custumization_options, image_url, description]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/update_menu_item/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, category, nutritional_info, custumization_options, image_url, description } = req.body;
        
        const result = await pool.query(
            'UPDATE "MenuItems" SET name = $1, price = $2, category = $3, nutritional_info = $4, custumization_options = $5, image_url = $6, description = $7 WHERE id = $8 RETURNING *',
            [name, price, category, nutritional_info, custumization_options, image_url, description, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Menu item not found' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add DELETE endpoint for menu items
app.delete('/delete_menu_item/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM "MenuItems" WHERE id = $1 RETURNING *', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Menu item not found' });
        }
        
        res.json({ message: `Menu item ${id} deleted successfully` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get order details by ID
app.get('/get_order_details/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const orderQuery = await pool.query(
            'SELECT * FROM orders WHERE id = $1',
            [id]
        );

        if (orderQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = orderQuery.rows[0];

        // Get order items - Updated table name to "OrderItems"
        const itemsQuery = await pool.query(
            'SELECT * FROM "OrderItems" WHERE order_id = $1',
            [id]
        );

        // Combine order with its items
        order.items = itemsQuery.rows;

        res.json(order);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to get order details' });
    }
});

// Create new order
app.post('/create_order', async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Log the entire request body
        console.log('Complete request body:', req.body);
        
        const {
            user_id,
            items,
            total_price,
            status = 'pending',  // Add default value
            loyalty_points = 0,  // Add default value
            points_used = 0,     // Add default value
            discount_applied = 0  // Add default value
        } = req.body;

        // Validate required fields
        if (!user_id || !items || !total_price) {
            throw new Error('Missing required fields: user_id, items, or total_price');
        }

        console.log('Received order data:', {
            user_id,
            total_price,
            status,
            loyalty_points,
            points_used,
            discount_applied,
            items_count: items?.length || 0
        });

        // Insert the order
        const orderResult = await client.query(
            `INSERT INTO public."Orders" 
            (user_id, total_price, status, loyalty_points, points_used, discount_applied, created_at) 
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) 
            RETURNING *`,
            [user_id, total_price, status, loyalty_points, points_used, discount_applied]
        );

        console.log('Order inserted:', orderResult.rows[0]);

        const order = orderResult.rows[0];

        // Insert order items
        for (let item of items) {
            console.log('Inserting item:', item);
            await client.query(
                `INSERT INTO public."OrderItems" 
                (order_id, name, price, quantity, customizations) 
                VALUES ($1, $2, $3, $4, $5)`,
                [order.id, item.name, item.price, item.quantity, item.customizations || {}]
            );
        }

        await client.query('COMMIT');
        
        res.status(201).json({
            message: 'Order created successfully',
            order: {
                ...order,
                items
            }
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Detailed error creating order:', {
            error: err,
            message: err.message,
            stack: err.stack,
            requestBody: req.body
        });
        res.status(500).json({ 
            error: 'Failed to create order',
            details: err.message,
            requestBody: req.body
        });
    } finally {
        client.release();
    }
});

// Get orders by user ID
app.get('/get_user_orders/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await pool.query(
            'SELECT * FROM "Orders" WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );

        // Get order items for each order
        const orders = await Promise.all(result.rows.map(async (order) => {
            const itemsResult = await pool.query(
                'SELECT * FROM "OrderItems" WHERE order_id = $1',
                [order.id]
            );
            return {
                ...order,
                items: itemsResult.rows
            };
        }));

        res.json(orders);
    } catch (err) {
        console.error('Error getting user orders:', err);
        res.status(500).json({ error: 'Failed to get user orders' });
    }
});

// Add error handling middleware
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// Add logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});