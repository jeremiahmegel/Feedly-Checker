Array.prototype.entSearch = function(id){
	for (var e = 0; e < this.length; e++) {
		if (this[e].id == id) {
			return e;
		}
	}
	return -1;
};