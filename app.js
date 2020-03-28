const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const {WEB} = require('./main.js');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.set('view engine', 'pug');

app.get('/', (req, res) =>{
    res.render('index',{titulo: 'Tarea 1', nombre: 'Marcos Rivas',web: WEB});
});

app.listen(3002, () =>{
    console.log('Servidor iniciado...');
});