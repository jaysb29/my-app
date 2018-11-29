import mongoose from 'mongoose';

var schema = mongoose.Schema;
module.exports = mongoose.model('user', new schema({ 
	uname: String,
	upass: String,
}));
