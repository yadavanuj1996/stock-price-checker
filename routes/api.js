'use strict';

var expect = require('chai').expect;
var MongoClient = require('mongodb');
const fetch = require('node-fetch');

const CONNECTION_STRING = process.env.MONGO_URI;
var database;
 MongoClient.connect(CONNECTION_STRING,(err, db)=>{
  if(err){
    console.log(err);
    return next(err);
  }
  database=db; //global variable
  console.log("db connected");
});

module.exports =(app)=> {

  app.route('/api/stock-prices')
    .get(function (req, res, next){
      if(Array.isArray(req.query.stock)){
          let stock1=req.query.stock[0].toUpperCase();
          let stock2=req.query.stock[1].toUpperCase();
          let stockPrice1=-1;
          let stockPrice2=-1;
          let promiseStock1=`https://api.iextrading.com/1.0/stock/${stock1}/book`;
          let promiseStock2=`https://api.iextrading.com/1.0/stock/${stock2}/book`;
          Promise.all([promiseStock1,promiseStock2].map(url =>
              fetch(url).then(resp => resp.text())
          )).then(texts => {
            stockPrice1=JSON.parse(texts[0]).quote.latestPrice;
            stockPrice2=JSON.parse(texts[1]).quote.latestPrice;
          
            let resultJSON={"stockData":[{"stock":stock1,"price":stockPrice1,"rel_likes":-1},{"stock":stock2,"price":stockPrice2,"rel_likes":1}]};
            return resultJSON;
          })
          .then(async(data)=>{
            let stockDetails1=await database.collection('stock-checker').findOne({stock: data.stockData[0].stock});
            let stockDetails2=await database.collection('stock-checker').findOne({stock: data.stockData[1].stock});
            data.stockData[0].rel_likes=stockDetails1.likes-stockDetails2.likes;
            data.stockData[1].rel_likes=stockDetails2.likes-stockDetails1.likes;
            return data;
          })
          .then(async(data)=>{
            let newLike=0;
            if(!!req.query.like && req.query.like==='true'){
              newLike=1;
            }   
             let a=await database.collection('stock-checker').update({stock: data.stockData[0].stock}, {$inc: {likes: newLike}}, {upsert: true});

             await database.collection('stock-checker').update({stock: data.stockData[1].stock}, {$inc: {likes: newLike}}, {upsert: true});
              res.json(data);
          })
         
      }
      else{
        let stock = req.query.stock.toUpperCase();
        let stockPrice;
        let newLike=0;
        if(!!req.query.like && req.query.like==='true'){
          newLike=1;
        }     
        fetch(`https://api.iextrading.com/1.0/stock/${stock}/book`)
          .then(res => res.json())
          .then(data => stockPrice = data.quote.latestPrice)
          .then(() => {
             database.collection('stock-checker').update({stock: stock}, {$inc: {likes: newLike}}, {upsert: true}, (err, stock) => {
                  if(err)
                    return next(err);
                  console.log("data successfully updated");
                });
                
                return ({stockData: {stock: stock, price: stockPrice.toString()}
             });
          })
          .then(data=>{
            database.collection('stock-checker').findOne({stock: data.stockData.stock},(err,stockDetails)=>{
              data.stockData.likes=parseInt(stockDetails.likes);
               res.send(data);
            });
          })
      }
     
        
    });

    
};
