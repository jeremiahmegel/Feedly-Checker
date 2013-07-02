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

checkCount();

chrome.alarms.onAlarm.addListener(function(alarm){
	if (alarm.name == "checkcount") {
		checkCount();
	}
});

chrome.browserAction.onClicked.addListener(function(buttonTab){
	chrome.tabs.create({url: "https://cloud.feedly.com/"});
});

chrome.runtime.onMessage.addListener(function(message, sender, respond){
	if ((message.name == "feedlyToken") && (message.data.feedlyToken) && (localStorage["feedlyToken"] != message.data.feedlyToken)) {
		localStorage["feedlyToken"] = message.data.feedlyToken;
		checkCount();
	}
});

function checkCount() {
	var request = new XMLHttpRequest();
	request.onreadystatechange = function(){
		if (request.readyState == 4) {// 4 = "loaded"
			console.log(request);
			if (request.status == 200) {// 200 = OK
				var totalCount = 0;
				JSON.parse(request.response).unreadcounts.forEach(function(value, index, array){
					if (value.id.indexOf("feed/") == 0) {
						totalCount += value.count;
					}
				});
				chrome.browserAction.setBadgeBackgroundColor({color: [63,127,255,255]});
				chrome.browserAction.setBadgeText({text: ((totalCount <= 0)?"":String(totalCount))});
			} else {
				chrome.browserAction.setBadgeBackgroundColor({color: [63,127,255,255]});
				chrome.browserAction.setBadgeText({text: "X"});
			}
		}
	};
	request.open("GET", "https://cloud.feedly.com/v3/markers/counts", true);
	request.setRequestHeader("Authorization", localStorage["feedlyToken"]);
	request.send(null);
	
	chrome.alarms.create("checkcount", {when: ((new Date()).getTime() + 60000)});
}