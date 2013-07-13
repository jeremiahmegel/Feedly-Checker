/*
	Copyright Jeremiah Megel 2013
	
	Feedly Checker is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	Feedly Checker is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.
	
	You should have received a copy of the GNU General Public License
	along with Feedly Checker. If not, see <http://www.gnu.org/licenses/>.
*/

var syncData;
if (localStorage["syncData"]) {
	syncData = JSON.parse(localStorage["syncData"]);
}
else {
	resetSyncData();
}

Object.prototype.removeValue = function(value){
	var pendInd = this.pending.entSearch(value.id);
	if (pendInd != -1) {
		this.pending.splice(pendInd, 1);
	}
	var syncInd = this.syncing.entSearch(value.id);
	if (syncInd != -1) {
		this.syncing.splice(syncInd, 1);
	}
};

Object.prototype.addValue = function(value){
	if ((this.pending.entSearch(value.id) == -1) && (this.syncing.entSearch(value.id) == -1)) {
		this.pending.push(value);
	}
};

Object.prototype.toggleSyncing = function(value, syncing){
	if (syncing == true) {
		var index = (this.syncing.push(value)-1);
		this.pending.splice(this.pending.indexOf(value), 1);
	}
	else {
		var index = (this.pending.push(value)-1);
		this.syncing.splice(this.syncing.indexOf(value), 1);
	}
	return index;
};

Object.prototype.allPending = function(){
	this.pending = this.pending.concat(this.syncing);
	this.syncing = [];
};

Object.prototype.allSyncing = function(){
	this.syncing = this.syncing.concat(this.pending);
	this.pending = [];
};

syncData.requests.markAsRead.categories.allPending();
syncData.requests.markAsRead.entries.allPending();
syncData.requests.keepUnread.entries.allPending();

chrome.alarms.clearAll();
var alarms = [];

alarmSet(60000, true, true, sync);

chrome.alarms.onAlarm.addListener(function(alarm){
	alarms[alarm.name].callback();
	if (alarms[alarm.name].repeat) {
		createAlarm(alarm.name, alarms[alarm.name].delay);
	}
});

chrome.runtime.onMessage.addListener(function(message, sender, respond){
	if (message.name == "feedlyAuth") {
		localStorage["feedlyToken"] = message.data.feedlyToken;
		localStorage["feedlyId"] = message.data.feedlyId;
		sync();
	}
	else if (message.name == "getSyncData") {
		respond({name: "syncData", data: syncData});
	}
	else if (message.name == "entriesRead") {
		updateRead("entries", message.data.entries);
	}
});

chrome.browserAction.onClicked.addListener(function(buttonTab){
	//chrome.tabs.create({url: "https://cloud.feedly.com/"});
});

chrome.browserAction.setBadgeBackgroundColor({color: [63,127,255,255]});

function resetSyncData() {
	syncData = {
			subscriptions : [],
			counts : {
				max : 0,
				unreadcounts : []
			},
			streams : [ {
				humanName : "All Unread",
				userSpecific: true,
				type : "category",
				name : "global.all",
				count : 20,
				unreadOnly : true,
				ranked : "oldest",
				entries : []
			}, {
				humanName : "Saved For Later",
				userSpecific: true,
				type : "tag",
				name : "global.saved",
				count : 20,
				unreadOnly : false,
				ranked : "newest",
				entries : []
			} ],
			requests : {
				markAsRead : {
					categories : {
						pending : [],
						syncing : []
					},
					entries : {
						pending : [],
						syncing : []
					}
				},
				keepUnread : {
					entries : {
						pending : [],
						syncing : []
					}
				}
			}
		};
		updateSyncData();
}

function alarmSet(delay, repeat, immediate, callback) {
	//	Handles the behavior of timing functions that need to be delayed or executed on an
	//		interval.
	//
	//	[delay] is how long (in milliseconds) to wait before executing the callback function.
	//	If [repeat] is set to true, the alarm will restart itself after each execution, causing
	//		the callback function to be executed every [delay] milliseconds.
	//	If [immediate] is set to true, the callback function will be executed immediately,
	//		in addition to waiting for the first alarm to complete. (The callback function
	//		will be executed at least twice.)
	//	[callback] specifies to function to execute when the alarm has completed (or when the
	//		alarm has first been set, if [immediate] is set to true).
	createAlarm(String(alarms.push({delay: delay, repeat: ((repeat===true)?true:false), callback: callback})-1), delay);
	if (immediate === true) {
		callback();
	}
}

function sync() {
	syncData.requests.markAsRead.categories.pending.forEach(function(catVal, catInd, catArr){
		var syncInd = syncData.requests.markAsRead.categories.toggleSyncing(catVal, true);
		ajax("http://cloud.feedly.com/v3/markers", "POST", JSON.stringify({"action": "markAsRead", "type": "categories", "categoryIds": [catVal.name], "asOf": catVal.asOf}), function(request){
			if ((request.status == 200) && (request.response == "OK")) {
				syncData.requests.markAsRead.categories.syncing.splice(syncInd, 1);
			}
			else {
				syncData.requests.markAsRead.categories.toggleSyncing(catVal, false);
			}
			updateSyncData();
		});
	});
	
	if (syncData.requests.markAsRead.entries.pending.length > 0) {
		syncData.requests.markAsRead.entries.allSyncing();
		var markingRead = idArr(syncData.requests.markAsRead.entries.syncing);
		ajax("http://cloud.feedly.com/v3/markers", "POST", JSON.stringify({"action": "markAsRead", "type": "entries", "entryIds": markingRead}), function(request){
			if (request.status != 200) {
				syncData.requests.markAsRead.entries.pending = syncData.requests.markAsRead.entries.pending.concat(markingRead);
			}
			syncData.requests.markAsRead.entries.syncing = syncData.requests.markAsRead.entries.syncing.filter(function(item) {
			    return markingRead.indexOf(item.id) === -1;
			});
		});
	}
	
	if (syncData.requests.keepUnread.entries.pending.length > 0) {
		syncData.requests.keepUnread.entries.allSyncing();
		var keepingUnread = idArr(syncData.requests.keepUnread.entries.syncing);
		ajax("http://cloud.feedly.com/v3/markers", "POST", JSON.stringify({"action": "keepUnread", "type": "entries", "entryIds": keepingUnread}), function(request){
			if (request.status != 200) {
				syncData.requests.keepUnread.entries.pending = syncData.requests.keepUnread.entries.pending.concat(markingRead);
			}
			syncData.requests.keepUnread.entries.syncing = syncData.requests.keepUnread.entries.syncing.filter(function(item) {
			    return keepingUnread.indexOf(item.id) === -1;
			});
		});
	}
	
	ajax("https://cloud.feedly.com/v3/markers/counts", "GET", null, function(request){
		//	Fetches the counts of unread articles.
		if (request.status == 200) {
			syncData.counts = JSON.parse(request.response);
			updateSyncData();
			displayCount();
		}
	});
	
	syncData.streams.forEach(function(strVal, strInd, strArr){
		//	Fetches the data/information of individual RSS entries.
		ajax("https://cloud.feedly.com/v3/streams/"
				+ ((strVal.userSpecific === true) ? "user%2F"
						+ localStorage["feedlyId"] + "%2F" : "") + strVal.type
				+ "%2F" + encodeURIComponent(strVal.name) + "/contents?count="
				+ strVal.count + "&unreadOnly=" + strVal.unreadOnly
				+ "&ranked=" + strVal.ranked, "GET", null, function(request){
			if (request.status == 200) {
				//	Compare the two arrays and add/replace applicable entries; do not simply replace
				//		one with the other. Actually, don't do this, because there would be read
				//		entries and such on the server side that the client would not have marked
				//		as read.
				syncData.streams[strInd].entries = JSON.parse(request.response).items.sort(sortEntries(strVal.ranked));
				updateSyncData();
			}
		});
	});
	
	ajax("http://cloud.feedly.com/v3/subscriptions", "GET", null, function(request){
		//	Fetches the data/information of the user's subscriptions (feeds).
		if (request.status == 200) {
			syncData.subscriptions = JSON.parse(request.response);
			updateSyncData();
		}
	});
}

function createAlarm(name, delay) {
	chrome.alarms.create(name, {when: ((new Date()).getTime() + delay)});
}

function ajax(url, method, data, callback) {
	//	Executes AJAX requests. Ensure that access to the URL is allowed via the content
	//		security policy in the manifest file.
	//
	//	[url] specifies the URL to request.
	//	[callback] specifies the function to execute when the request's ready state has
	//		changed. It will be passed an XMLHttpRequest parameter.
	var request = new XMLHttpRequest();
	request.onreadystatechange = function(){
		if (request.readyState == 4) { // 4 == "loaded"
			callback(request);
		}
	};
	request.open(method, url, true);
	request.setRequestHeader("Authorization", localStorage["feedlyToken"]);
	request.send(data);
}

function updateSyncData() {
	localStorage["syncData"] = JSON.stringify(syncData);
}

function sortEntries(ranked) {
	if (ranked == "oldest") {
		return function(a, b){
			return a.published-b.published;
		}
	}
	else if (ranked == "newest") {
		return function(a, b){
			return b.published-a.published;
		}
	}
}

function updateRead(type, data) {
	forEach(data, function(value, index, array){
		if (value.read === true) {
			if (type == "entries") {
				syncData.requests.keepUnread.entries.removeValue(value);
				syncData.requests.markAsRead.entries.addValue(value);
			}
			else if (type == "categories") {
				var time = new Date().getTime();
				if (syncData.requests.markAsRead.categories.pending.length == 0) {
					syncData.requests.markAsRead.categories.pending.push({name: value, asOf: time});
				}
				else {
					var catFound = false;
					forEach(syncData.requests.markAsRead.categories.pending, function(catVal, catInd, catArr){
						if (!catFound) {
							if (data.indexOf(catVal.name) != -1) {
								syncData.requests.markAsRead.categories.pending[catInd].asOf = time;
								catFound = true;
							}
							else if (catInd >= (catArr.length-1)) {
								syncData.requests.markAsRead.categories.pending.push({name: value, asOf: time});
							}
						}
					});
				}
			}
		}
		else if (value.read === false) {
			if (type == "entries") {
				syncData.requests.markAsRead.entries.removeValue(value);
				syncData.requests.keepUnread.entries.addValue(value);
			}
		}
	});
	updateSyncData();
	displayCount();
}

function displayCount() {
	var totalCount = 0;
	var plus = false;
	forEach(syncData.counts.unreadcounts, function(value, index, array){
		if (value.id.indexOf("feed/") == 0) {
			var asOf = null;
			var feedIds = [value.id];
			forEach(syncData.subscriptions, function(subVal, subInd, subArr){
				if (subVal.id == value.id) {
					forEach(subVal.categories, function(subCatVal, subCatInd, subCatArr){
						feedIds.push(subCatVal.id);
					});
				}
			});
			forEach(syncData.requests.markAsRead.categories.pending.concat(syncData.requests.markAsRead.categories.syncing), function(catVal, catInd, catArr){
				if (feedIds.indexOf(catVal.name) !== -1) {
					asOf = catVal.asOf;
				}
			});
			if (asOf === null) {
				var offset = 0;
				forEach(syncData.requests.markAsRead.entries.pending.concat(syncData.requests.markAsRead.entries.syncing), function(readVal, readInd, readArr){
					if ((readVal.feed == value.id) && (readVal.initial == "false")) {
						offset--;
					}
				});
				forEach(syncData.requests.keepUnread.entries.pending.concat(syncData.requests.keepUnread.entries.syncing), function(unVal, unInd, unArr){
					if ((unVal.feed == value.id) && (unVal.initial == "true")) {
						offset++;
					}
				});
				var feedCount = (value.count+offset);
				totalCount += ((feedCount >= 0)?feedCount:0);
			}
			else if (asOf < value.updated) {
				plus = true;
			}
		}
	});
	chrome.browserAction.setBadgeText({text: ((totalCount>0)?String(totalCount):"")+((plus)?"+":"")});
}

function forEach(array, func) {
	for (var i = 0; i < array.length; i++) {
		func(array[i], i, array);
	}
}

function idArr(inpArr) {
	var retArr = [];
	forEach(inpArr, function(value, index, array){
		retArr.push(value.id);
	});
	return retArr;
}