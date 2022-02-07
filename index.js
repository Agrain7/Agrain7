const express = require('express');
const app = express();
const port = 5000;
const { User } = require("./models/User");

const config = require("./config/key")

//www-form
app.use(express.urlencoded({extended: true}));

//json type
app.use(express.json());


const mongoose= require('mongoose')
mongoose.connect(config.mongoURI, {

}).then(() => console.log('MongoDB Connected..'))
  .catch(err => console.log('err',err));

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.post('/register', (req, res) => {

  //회원 가입 시 받아온 정보를 데이터 베이스에 저장

  const user = new User(req.body);

  user.save((err, doc) => {
    if(err) return res.json({ success:false, err})
    return res.status(200).json({
      success: true
    })
  })
});



app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
});
