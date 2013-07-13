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

window.addEventListener("load", function(){
	var entries = document.getElementById("entries");
	var utmHeaderHeight = (parseInt(window.getComputedStyle(document.getElementById("utmHeader")).height, 10)+2);
	
	var streamSec = document.createElement("section");
		streamSec.setAttribute("data-expanded", "true");
		var streamA = document.createElement("a");
			streamA.setAttribute("href", "#s");
			streamA.setAttribute("target", "_self");
			var expandIndic = document.createElement("span");
				expandIndic.innerHTML = "▼";
			streamA.appendChild(expandIndic);
			var streamName = document.createElement("span");
			streamA.appendChild(streamName);
		streamSec.appendChild(streamA);
		var entConMaj = document.createElement("div");
			var entConMin = document.createElement("div");
			entConMaj.appendChild(entConMin);
		streamSec.appendChild(entConMaj);
	
	var entSec = document.createElement("section");
		entSec.setAttribute("data-expanded", "false");
		var entHeader = document.createElement("header");
			var a = document.createElement("a");
				a.setAttribute("href", "#e");
				a.setAttribute("target", "_self");
				var title = document.createElement("span");
					title.setAttribute("class", "title");
				a.appendChild(title);
				var info = document.createElement("div");
					info.setAttribute("class", "info");
					var attrib = document.createElement("span");
						attrib.setAttribute("class", "attrib");
					info.appendChild(attrib);
					var time = document.createElement("span");
						time.setAttribute("class", "time");
					info.appendChild(time);
				a.appendChild(info);
				entHeader.appendChild(a);
			var controls = document.createElement("ul");
				controls.setAttribute("class", "controls");
				var readCon = document.createElement("a");
					readCon.setAttribute("class", "readCon");
					readCon.setAttribute("href", "#r");
					readCon.setAttribute("target", "_self");
				controls.appendChild(readCon);
				var openCon = document.createElement("a");
					openCon.setAttribute("class", "openCon");
				controls.appendChild(openCon);
			entHeader.appendChild(controls);
		entSec.appendChild(entHeader);
		var contentCon = document.createElement("div");
			contentCon.setAttribute("class", "content");
			var content = document.createElement("div");
			contentCon.appendChild(content);
		entSec.appendChild(contentCon);
	
	chrome.runtime.sendMessage({name: "getSyncData"}, function(response){
		if (response.name == "syncData") {
			console.log(response);
			response.data.streams.forEach(function(strVal, strInd, strArr){
				var streamRead = false;
				var feedIds = [((strVal.userSpecific === true) ? "user/"
						+ localStorage["feedlyId"] + "/" : "") + strVal.type
						+ "/" + strVal.name];
				for (var s = 0; s < response.data.subscriptions.length; s++) {
					if (response.data.subscriptions[s].id == feedIds[0]) {
						for (var c = 0; c < response.data.subscriptions[s].categories.length; c++) {
							feedIds.push(response.data.subscriptions[s].categories[c].id);
						}
					}
				}
				var concatArr = response.data.requests.markAsRead.categories.pending.concat(response.data.requests.markAsRead.categories.syncing);
				for (var cat = 0; cat < concatArr.length; cat++) {
					if (feedIds.indexOf(concatArr[cat].name) !== -1) {
						streamRead = true;
					}
				}
				var stream = streamSec.cloneNode(true);
				stream.setAttribute("name", feedIds[0]);
				var entLoc = stream.getElementsByTagName("div")[0].getElementsByTagName("div")[0];
				stream.getElementsByTagName("a")[0].getElementsByTagName("span")[1].innerHTML = strVal.humanName;
				stream.getElementsByTagName("a")[0].addEventListener("click", expandStream);
				if (!streamRead) {
					strVal.entries.forEach(function(entVal, entInd, entArr){
						var read = false;
						if ((response.data.requests.markAsRead.entries.pending.entSearch(entVal.id) !== -1) || (response.data.requests.markAsRead.entries.syncing.entSearch(entVal.id) !== -1)) {
							read = true;
						}
						else if ((response.data.requests.keepUnread.entries.pending.entSearch(entVal.id) !== -1) || (response.data.requests.keepUnread.entries.syncing.entSearch(entVal.id) !== -1)) {
							read = false;
						}
						else {
							read = (!entVal.unread);
						}
						if ((!read) || (!strVal.unreadOnly)) {
							var entry = entSec.cloneNode(true);
							entry.setAttribute("name", entVal.id);
							entry.setAttribute("data-read", read);
							entry.setAttribute("data-initialRead", (!entVal.unread));
							entry.setAttribute("data-origin", entVal.origin.streamId);
							var entryElems = {
								a: entry.getElementsByTagName("header")[0].getElementsByTagName("a")[0],
								div: entry.getElementsByTagName("header")[0].getElementsByTagName("a")[0].getElementsByTagName("div")[0],
								content: entry.getElementsByClassName("content")[0].getElementsByTagName("div")[0]
							};
							entryElems.a.addEventListener("click", expandEntry);
							entryElems.a.getElementsByClassName("title")[0].innerHTML = entVal.title;
							entryElems.div.getElementsByClassName("attrib")[0].innerHTML = ((entVal.author)?"by "+entVal.author+" ":"");
							response.data.subscriptions.forEach(function(subVal, subInd, subArr){
								if (subVal.id == entVal.origin.streamId){
									entryElems.div.getElementsByClassName("attrib")[0].innerHTML += "in "+subVal.title;
								}
							});
							entryElems.div.getElementsByClassName("time")[0].innerHTML = moment(entVal.published).fromNow();
							entryElems.div.getElementsByClassName("time")[0].setAttribute("title", "Published: "+moment(entVal.published).format("llll")+"\nReceived: "+moment(entVal.crawled).format("llll"));
							entry.getElementsByClassName("readCon")[0].addEventListener("click", function(){
								markEntryRead(this.parentNode.parentNode.parentNode, "toggle");
							});
							if (entVal.canonical) {
								entry.getElementsByClassName("openCon")[0].setAttribute("href", entVal.canonical[0].href);
							}
							else {
								entry.getElementsByClassName("openCon")[0].setAttribute("href", entVal.alternate[0].href);
							}
							entryElems.content.innerHTML = entVal.summary.content;
							entry.getElementsByClassName("content")[0].style.webkitTransition = "height 0.5s";
							entLoc.appendChild(entry);
						}
					});
				}
				else {
					//	Display a message about waiting until the next sync for articles to appear.
					//		Does this count if the stream isn't an unreadOnly stream?
				}
				entries.appendChild(stream);
			});
		}
	});
	
	function expandStream() {
		var wholeStream = this.parentNode;
		var indicator = this.getElementsByTagName("span")[0];
		var majCon = this.parentNode.getElementsByTagName("div")[0];
		if (wholeStream.getAttribute("data-expanded") != "false") {
			wholeStream.setAttribute("data-expanded", "false");
			majCon.style.height = "0px";
			indicator.innerHTML = "▶";
		}
		else {
			wholeStream.setAttribute("data-expanded", "true");
			majCon.style.height = "auto";
			indicator.innerHTML = "▼";
		}
	}

	function expandEntry() {
		var secCon = this.parentNode.parentNode;
		var contentShow = secCon.getElementsByClassName("content")[0];
		if (secCon.getAttribute("data-expanded") != "true") {
			secCon.setAttribute("data-expanded", "true");
			markEntryRead(secCon, true);
			$("html, body").animate({scrollTop: $(secCon).offset().top-utmHeaderHeight}, 500);
			contentShow.style.height = window.getComputedStyle(contentShow.getElementsByTagName("div")[0]).height;
		}
		else {
			secCon.setAttribute("data-expanded", "false");
			contentShow.style.height = "0px";
		}
		return false;
	}
	
	function markEntryRead(secCon, read) {
		console.log(secCon, read);
		if (read == "toggle") {
			read = (secCon.getAttribute("data-read") != "true");
		}
		var readEnts = document.getElementsByName(secCon.getAttribute("name"));
		for (var e = 0; e < readEnts.length; e++) {
			readEnts[e].setAttribute("data-read", read);
		}
		chrome.runtime.sendMessage({name: "entriesRead", data: {entries: [{id: secCon.getAttribute("name"), feed: secCon.getAttribute("data-origin"), read: read, initial: secCon.getAttribute("data-initialRead")}]}});
	}
	
	function forEach(array, func) {
		for (var i = 0; i < array.length; i++) {
			func(array[i], i, array);
		}
	}
});