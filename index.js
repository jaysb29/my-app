import express from 'express'
import bodyParser from 'body-parser'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose' 
import async from 'async'
import {isEmpty, trim, isSet, isArray, isObject } from 'lodash';

//File Imports
import config from './config'
import User from './models/user'
import Battle from './models/battle'


//Express Configurations
const app = express()
const port = 3000
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json())
app.listen(port);
const appRoutes = express.Router(); 


//Database connection
mongoose.connect(config.database, { useNewUrlParser: true });


//Create Token
appRoutes.post('/generate-token', (req, res) => {
	if (isEmpty(trim(req.body.uname))) {
		return res.status(401).send({ 
	        message: 'Missing Param' 
	    });
	}
	User.findOne({uname:req.body.uname}, (err, user) => {
         if (err) {
            return res.status(500).send(err)
         } else {
         	let payload = {
         		name:user.uname,
         		admin:true
         	}
         	let token = jwt.sign(payload, config.secret, {expiresIn: '72h'});
         	return res.status(200).json({
	          message: 'Token generated successfully',
	          token: token
	        });
         }
    });
});


//Configure for JWT Verification
appRoutes.use((req, res, next) => {
	let token = req.headers['x-access-token'];
	if (token) {
		jwt.verify(token, config.secret, (err, decodedtoken) => {
			if(err) {
				return res.status(403).send({
		          message: 'Invalid Token'
		        });
			} else {
				req.decodedtoken = decodedtoken
				next()
			}
        });
	} else {
		// if there is no token return an error
     	return res.status(403).send({ 
        	message: 'No token provided.' 
    	});
	}
})

//APIs Starts here

//Get Count
appRoutes.get('/count', (req, res) => {
    Battle.collection.countDocuments({}, (err, totalCount) => {
         if (err) {
            return res.status(500).send(err) 
         } else {
            return res.status(200).send('Total Battles:- ' + totalCount)
         }
    });
})


//Get Battles List 
appRoutes.get('/list', (req, res) => {
    Battle.distinct('location', (err, battledata) => {
         if (err) {
            return res.status(500).send(err) 
         } else {
            return res.status(200).send(battledata)
         }
    });
})

appRoutes.get('/search', function (req, res) {

 	let query = {'$and':[]}
 	query['$and'].push({ '$or':[ {attacker_king: req.query.king}, {defender_king:req.query.king} ] })
 	
 	if(req.query.location) {
 		query['$and'].push({'location':req.query.location})
 	}
 	if(req.query.type) {
 		query['$and'].push({'battle_type':req.query.type})
 	}
    Battle.find(query, function(err, searchResults) {
         if (err) {
            return res.status(500).send(err) 
         } else {
            return res.status(200).send(searchResults)
         }
    });
})

appRoutes.get('/stats', function (req, res) {
	async.parallel({
		'attacker_king': function(callback) {
			return Battle.aggregate([{
				"$group" : {
					_id:"$attacker_king", 
					count:{$sum:1}
				}}, 
				{$sort : {count : -1}}, 
				{$limit :1}
			], callback)
		},
		'defender_king': function(callback) {
			return Battle.aggregate([{
				"$group" : {
					_id:"$defender_king", 
					count:{$sum:1}
				}}, 
				{$sort : {count : -1}}, 
				{$limit :1}
			], callback)
		},
		'region': function(callback) {
			return Battle.aggregate([{
				"$group" : {
					_id:"$region", 
					count:{$sum:1}
				}}, 
				{$sort : {count : -1}}, 
				{$limit :1}
				], callback)
		},
		'name': function(callback) {
			return Battle.aggregate([{
				"$group" : {
					_id:"$name", 
					count:{$sum:1}
				}}, 
				{$sort : {count : -1}}
			], callback)
		},
		attacker_outcome: function(callback) {
			return Battle.aggregate([{ 
				"$group" : { 
					_id : "$attacker_outcome", 
					count : {$sum:1 } 
				} 
			}], callback )
		},
		'battle_type': function(callback) {
			return Battle.distinct("battle_type", {"battle_type" : {$ne:''}}, callback)
		},
		defender_size: function(callback) {
			return Battle.aggregate([{
				 $match: {
               		defender_size: { $ne: "" },
            	}},
        		{$group: { 
					_id : 'null', 
					min: {$min : '$defender_size'}, 
					average: {$avg: '$defender_size'}, 
					max: {"$max": '$defender_size'}
				} 
			}], callback)
		}
	},
	function(err, response) {
		if (err) {
			return res.send(response)
		} else {
			let statsResponse = {
				'most_active': {
					'attacker_king':'',
					 'defender_king':'',
					 'region':'',
					 'name':''
				},
				'attacker_outcome': {
					'win':'',
					'loss':''
				},
				'battle_type':[],
				'defender_size': {
					'average':'',
					'min':'',
					'max':'',
				},
			}
			if (response.attacker_king) {
				statsResponse.most_active.attacker_king = response.attacker_king[0]._id
			}
			if (response.defender_king) {
				statsResponse.most_active.defender_king = response.defender_king[0]._id
			}
			if (response.region) {
				statsResponse.most_active.region = response.region[0]._id
			}
			if (response.name) {
				statsResponse.most_active.name = response.name[0]._id
			}
			if (response.attacker_outcome){
				response.attacker_outcome.forEach(function(item){
					if(item._id == 'loss') {
						statsResponse.attacker_outcome.loss = item.count
					}
					if(item._id == 'win') {
						statsResponse.attacker_outcome.win = item.count
					}
				})
			}
			if (response.battle_type){
				statsResponse.battle_type = response.battle_type
			}
			if (response.battle_type){
				statsResponse.battle_type = response.battle_type
			}
			if (response.defender_size){
				statsResponse.defender_size.average = response.defender_size[0].average
				statsResponse.defender_size.min = response.defender_size[0].min
				statsResponse.defender_size.max = response.defender_size[0].max
			}
			return res.send(statsResponse)
		}
 	});
	
})

app.use('/api', appRoutes);


