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

var feedlyToken = JSON.parse(localStorage["session@cloud"]).feedlyToken;
if (feedlyToken) {
	chrome.runtime.sendMessage({name: "feedlyToken", data: {feedlyToken: feedlyToken}});
}