const express = require('express');
const app = express();
const port = process.env.PORT || 3030;
const {Pool} = require('pg');
const bodyParser = require('body-parser');

app.use(bodyParser.json());

const pool = new Pool({
    user: "canteen_user",
    host: "dpg-ctb53d23esus739enoi0-a.oregon-postgres.render.com",	
    database: "canteen_ordering_system_v2wm",
    password: "IcFZzRE06ZOIKscHu0twuleg9i3VAkX1",
    port: 5432,
    ssl: true
})

if(pool.connect()){
    console.log("Server Connected Successfully!!");
}

app.post('/create_new_user_info',async(req, res)=>{
    const {username, email, password, dietary_restrictions, allergies} = req.body;

    const query = await pool.query(
        'INSERT INTO users (username, email, password, dietary_restrictions, allergies) VALUES ($1 , $2, $3, $4, $5) RETURNING *',
        [username,email,password,dietary_restrictions,allergies]
    );

    console.log(username);
    console.log(email);
    console.log(password);
    console.log(dietary_restrictions);
    console.log(allergies);
     
    res.status(201).json({message:"User Information has been created",info: query.rows[0]})
})

app.get('/get_all_user_info',async(req,res)=>{
    const query = await pool.query(
        'SELECT * FROM users ORDER BY id ASC'
    )

    res.status(200).json(query.rows);
})


app.listen(port,()=> {
    console.log(`Server is running on http://localhost:${port}`)
})