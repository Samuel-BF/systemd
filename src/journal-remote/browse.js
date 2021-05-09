/* SPDX-License-Identifier: LGPL-2.1-or-later */

function htmlElement(tagName, attributes = {}, text = "") {
        let element = document.createElement(tagName);
        for (let [name, value] of Object.entries(attributes))
                element.setAttribute(name, value);

        if (text)
                element.appendChild(document.createTextNode(text));

        return element;
}

function clickableIcon(content, callback, title, clazz = "") {
        const icon = htmlElement("button", {class: "icon " + clazz, title: title, type: "button"}, content);
        icon.addEventListener("click", callback);
        return icon;
}

function connectionError() {
        document.getElementById("connectionError").style.display = "block";
}

function appError() {
        document.getElementById("appError").style.display = "block";
}

function noEntriesError() {
        document.getElementById("noEntriesError").style.display = "block";
}

function clearEntriesError() {
        document.getElementById("connectionError").style.display = "none";
        document.getElementById("appError").style.display = "none";
        document.getElementById("noEntriesError").style.display = "none";
}

function filterNoValueError(filterName, filterValues) {
        const filterErrorsBlock = document.getElementById("filterErrors");
        let message = "For field " + filterName + ", value";
        const lastValue = filterValues.pop();
        if (filterValues.length)
                message += "s " + filterValues.join(", ") + " and " + lastValue + " do not exist anymore.";
        else
                message += " " + lastValue + " does not exist anymore.";
        filterErrorsBlock.appendChild(document.createTextNode(message));
        filterErrorsBlock.appendChild(htmlElement("br"));
        filterErrorsBlock.style.display = "block";
}

function filterNoExistError(filterNames) {
        const filterErrorsBlock = document.getElementById("filterErrors");
        filterNames.forEach(field => {
                filterErrorsBlock.appendChild(document.createTextNode("Field " + field + " is not present anymore."));
                filterErrorsBlock.appendChild(htmlElement("br"));
        });
        if (filterNames.length)
                filterErrorsBlock.style.display = "block";
}

function cantFindEntriesError(entriesNotFound) {
        const errorBlock = htmlElement("div", {id: "cantFindEntriesError", class: "errorbox"});
        errorBlock.appendChild(document.createTextNode("Unable to find entr" + (entriesNotFound.length > 1 ? "ies ":"y ")));

        function linkAndJoin(cursor, index, array) {
                const url = "?entry="+encodeURIComponent(cursor)+"&cursor="+encodeURIComponent(cursor)+"&offset=-5";
                const link = htmlElement("a", {href: url, target: "_blank"}, cursor.substr(-10));
                link.addEventListener("click", event => {event.stopPropagation();});
                errorBlock.appendChild(link);
                if (index < array.length - 2)
                        errorBlock.appendChild(document.createTextNode(", "));
                else if (index == array.length - 2)
                        errorBlock.appendChild(document.createTextNode(" and "));

        }
        entriesNotFound.forEach(linkAndJoin);
        errorBlock.addEventListener("click", event => event.currentTarget.style.display = "none")

        document.getElementById("cantFindEntriesError").replaceWith(errorBlock);
        errorBlock.style.display = "block";
}

function validateResponseStatus(response) {
        if (response.ok)
                return response;

        responseMsg = t => Promise.reject("Failed to load " + response.url + " (" + response.status + ") : " + t);
        return response.text().then(responseMsg);
}

function newlineSeparatedJson(text) {
        const values = [];
        for (line of text.split("\n")) {
                try {
                        values.push(Object.values(JSON.parse(line))[0]);
                } catch(e) {
                }
        }
        return values;
}

function loadingOption() {
        const option = new Option("Loading...", "");
        option.disabled = true;
        return option;
}

function insertOptionAlphabetically(select, option, optionCallback) {
        const firstOptionAfter = Array.from(select.childNodes)
                .slice(1)
                .filter(o => optionCallback(o) > optionCallback(option))
                .shift();
        if (firstOptionAfter == undefined)
                select.add(option);
        else
                firstOptionAfter.insertAdjacentElement("beforebegin", option);
}

function insertOptionAlphabeticallyByValue(select, option) {
        insertOptionAlphabetically(select, option, option => option.value);
}

function insertOptionAlphabeticallyByLabel(select, option) {
        insertOptionAlphabetically(select, option, option => option.label);
}

class Field {
        filterable = false;
        name;

        constructor(name) {
                this.name = name;
        }

        static _blobAsHex(intArray) {
                return intArray
                        .map((b, index) => b.toString(16) + (index % 8 == 7 ? " ":""))
                        .join("");
        }

        static _blobAsAscii(intArray, truncate = false) {
                if (truncate)
                        intArray.splice(truncate);

                return intArray.map(b => b <= 0x1F || b >= 0x80 ? "." : String.fromCharCode(b)).join("")
                        + (truncate && intArray.length > truncate ? " (...)" : "");
        }

        static valueCSV(value) {
                if (typeof value == "string")
                        return value;

                if (value == null)
                        return "[large blob data]";

                if (value instanceof Array && value.length > 0 && typeof value[0] == "number")
                        return "0x"+this._blobAsHex(value);

                if (value instanceof Array && value.length > 0)
                        return value.map(v => Field.valueCSV(v)).join("\n");

                return "[invalid data]";
        }

        static valueInterpreted(value, truncate = false) {
                if (value instanceof Array && value.length > 0 && typeof value[0] == "number")
                        return this._blobAsAscii(value, truncate);

                if (value instanceof Array && value.length > 0)
                        return value.map(v => this.valueInterpreted(v)).join("\n");

                return this.valueCSV(value);
        }

        valueDetails(value, blockTag = "td") {
                if (value instanceof Array && value.length > 0 && typeof value[0] == "number")
                        return htmlElement(blockTag, {}, "0x" + Field._blobAsHex(value) + "\n[ascii]\n" + Field._blobAsAscii(value));

                if (value instanceof Array && value.length > 0) {
                        const block = htmlElement(blockTag);
                        value.forEach(v => block.appendChild(this.valueDetails(v, "div")));
                        return block;
                }

                return htmlElement(blockTag, {}, Field.valueCSV(value));
        }
}
class TimeField extends Field {
        static valueInterpreted(value, truncate = false) {
                if (typeof value == "string") {
                        const date = new Date(parseInt(value) / 1000);
                        if (date.toString() == "Invalid Date")
                                return value;

                        return date.toLocaleString() + "." + (value % 1000).toString().padStart(3, 0);
                }
                return super.valueInterpreted(value, truncate);
        }

        valueDetails(value, blockTag = "td") {
                return htmlElement(blockTag, {}, TimeField.valueInterpreted(value));
        }
}
class Filter extends Field {
        filterable = true;
        option;
        defaultValue = [""];
        _input;
        _onChange = () => {};

        constructor(name, onChangeCallback) {
                super();
                this.name = name;
                let label = name.replace(/_/g, " ").trim().toLowerCase();
                label = label[0].toUpperCase() + label.substring(1);
                this.option = new Option(label, name);
                this._onChange = () => onChangeCallback();
        }

        _changeValue(event) {
                if (event.target.value == "")
                        event.target.remove();
                if (this._input.lastChild.value != "")
                        this._input.appendChild(this._inputBlock());
                this._onChange();
        }

        _inputBlock(value = "") {
                const input = htmlElement("input", {type: "text", name: this.name, value: value});
                input.addEventListener("change", event => this._changeValue(event));
                return input;
        }

        _inputBlocks(initialValue) {
                this._input = htmlElement("span");
                initialValue.filter(v => v != "").forEach(v => this._input.appendChild(this._inputBlock(v)) );
                this._input.appendChild(this._inputBlock());
                return [document.createTextNode(" = "), this._input];
        }

        _labelBlock() {
                const block = htmlElement("p", {id: this.name});
                block.appendChild(clickableIcon("×", () => this.unselect(), "Remove filter on " + this.option.label, "remove"))
                block.appendChild(document.createTextNode(this.option.label));
                return block;
        }

        isFiltering() {
                return this._input.childNodes.length > 1;
        }

        valueToEntriesQuery(searchParams) {
                Array.from(this._input.childNodes).forEach(input => {
                        if (input.value != "")
                                searchParams.append(this.name, input.value);
                });
                return;
        }

        select(initialValue) {
                const labelBlock = this._labelBlock();
                this._inputBlocks(initialValue).forEach(block => labelBlock.appendChild(block));
                document.getElementById("filters").appendChild(labelBlock);
                this.option.classList.add("selected");
                if (this.isFiltering())
                        this._onChange();
        }

        valueFromURL(searchParams) {
                return searchParams.getAll(this.name) ?? this.defaultValue;
        }

        unselect() {
                document.getElementById(this.name).remove();
                this.option.classList.remove("selected");
                if (this.isFiltering())
                        this._onChange();
        }

        isSelected() {
                return this.option.classList.contains("selected");
        }

        toggleSelect() {
                if (this.isSelected())
                        this.unselect();
                else
                        this.select(this.defaultValue);
        }

        setValue(value) {
                if (!this.isSelected())
                        return this.select(value);

                Array.from(this._input.childNodes).forEach(input => input.remove());
                this._input.appendChild(this._inputBlock(value));
                this._input.appendChild(this._inputBlock(""));
                return this._onChange();
        }

        _valueDetailsFromString(value, blockTag) {
                const block = htmlElement(blockTag, {}, value);
                block.appendChild(clickableIcon("🔎", () => this.setValue([value]), "Select entries where " + this.name +  " = " + value));
                return block;
        }

        valueDetails(value, blockTag = "td") {
                if (typeof value == "string")
                        return this._valueDetailsFromString(value, blockTag);

                return super.valueDetails(value, blockTag);
        }
}

class IdFilter extends Filter {
        _inputBlock(value) {
                const input = htmlElement("input", {type: "number", name: this.name, value: value, min: 0});
                input.addEventListener("change", event => this._changeValue(event));
                return input;
        }
}

class PriorityFilter extends Filter {
        defaultValue = "7";
        _priorityLabel = {
                "0": "0 Emergency",
                "1": "1 Alert",
                "2": "2 Critical",
                "3": "3 Error",
                "4": "4 Warning",
                "5": "5 Notice",
                "6": "6 Informational",
                "7": "7 Debug"
        };
        _label;

        isFiltering() {
                return this._input.value != this.defaultValue;
        }

        valueToEntriesQuery(searchParams) {
                if (!this.isSelected() || !this.isFiltering())
                        return;
                Array.from(new Array(parseInt(this._input.value)+1),(val,index)=>index)
                        .forEach(i => searchParams.append(this.name, i));
                return;
        }

        _onPriorityChange() {
                this._label.textContent = this._priorityLabel[this._input.value];
                this._onChange();
        }

        _inputBlocks(initialValue) {
                this._input = htmlElement("input", {name: this.name, type:"range", min: 0, max: 7, value:initialValue});
                this._input.addEventListener("change", () => this._onPriorityChange());
                this._label = htmlElement("b", {id: "priority_label"}, this._priorityLabel[initialValue]);
                return [document.createTextNode(" ≤ "),
                        this._input,
                        document.createTextNode(" ("),
                        this._label,
                        document.createTextNode(")")];
        }

        _valueDetailsFromString(value, blockTag) {
                const block = htmlElement(blockTag, {title: value}, this._priorityLabel[value] ?? "invalid value");
                block.appendChild(clickableIcon("🔎", () => this.setValue(value), "Select entries where " + this.name +  " ≤ " + value));
                return block;
        }

        setValue(value) {
                if (!this.isSelected())
                        return this.select(value);

                this._input.value = Math.max(0, Math.min(7, value));
                this._onPriorityChange();
        }
}

class MultiSelectFilter extends Filter {
        _exclude;
        _options = [];
        _valuesPromise = null;
        _valuesPromiseRejected = false;
        _valuesPromiseController;
        _valuesLabelBlock;
        defaultValue = {selection: [], exclude: false};

        _selectedValueBlock(htmlOption) {
                const block = htmlElement("span", {class: "filtervalue"}, htmlOption.label);
                block.appendChild(clickableIcon("×", () => this.toggleOption(htmlOption), "Unselect value " + htmlOption.label, "remove"));
                return block;
        }

        _resetValuesLabelAndSelectValue() {
                const selectedOptions = this._options.filter(o => o.classList.value == "selected");

                this._input.options[0].value = JSON.stringify(selectedOptions.map(o => o.value));
                this._input.selectedIndex = 0;

                const labelBlock = htmlElement("span", {id : this.name + "_labels"});

                if (selectedOptions.length == 0) {
                        labelBlock.append(htmlElement("span", {class: "filtervalue"}, "Any"));
                } else {
                        let currentOption = null;
                        while (currentOption = selectedOptions.shift()) {
                                labelBlock.append(this._selectedValueBlock(currentOption));
                                if (selectedOptions.length >= 2)
                                        labelBlock.append(document.createTextNode(", "));
                                else if (selectedOptions.length == 1)
                                        labelBlock.append(document.createTextNode(" or "));
                        }
                }
                this._valuesLabelBlock.replaceWith(labelBlock);
                this._valuesLabelBlock = labelBlock;
        }

        isFiltering() {
                return this._input.value != "[]";
        }

        toggleOption(option) {
                option.classList.toggle("selected");
                this._resetValuesLabelAndSelectValue();
                this._onChange();
        }

        _selector(values = [], selectedValues = []) {
                const select = htmlElement("select", {name: this.name});

                select.addEventListener("change", event => this.toggleOption(event.target.selectedOptions[0]));
                select.add(new Option("▾", JSON.stringify(selectedValues), true));
                this._options = values.sort().map(value => {
                        const opt = new Option(value == "" ? "[empty value]" : value, value);
                        opt.classList.toggle("selected", selectedValues.includes(value));
                        select.add(opt);
                        return opt;
                });

                return select;
        }

        _newOption(value) {
                const option = new Option(value == "" ? "[empty value]" : value, value);
                this._options.push(option);
                insertOptionAlphabeticallyByValue(this._input, option)
        }

        _onValuesReceive(newValues) {
                const selectedValues = this._options.filter(o => o.classList == "selected").map(o => o.value);
                const missingSelectedValues = selectedValues.filter(v => !newValues.includes(v));

                const newSelect = this._selector(newValues, selectedValues);
                this._input.replaceWith(newSelect);
                this._input = newSelect;
                this._resetValuesLabelAndSelectValue();

                if (missingSelectedValues.length > 0 && !this._exclude.checked) {
                        filterNoValueError(this.name, missingSelectedValues);
                        this._onChange();
                }

                return newValues;
        }

        _values() {
                if (this._valuesPromise == null || this._valuesPromiseRejected) {
                        const loading = loadingOption();
                        this._input.add(loading);
                        this._valuesPromiseRejected = false;
                        this._valuesPromiseController = new AbortController();
                        this._valuesPromise = fetch("fields/" + encodeURIComponent(this.name), {
                                        headers: new Headers({Accept: "application/json"}),
                                        signal: this._valuesPromiseController.signal
                                })
                                .then(validateResponseStatus)
                                .then(response => response.text())
                                .then(newlineSeparatedJson)
                                .then(values => this._onValuesReceive(values))
                                .finally(() => loading.remove());
                        this._valuesPromise.catch(() => this._valuesPromiseRejected = true);
                }

                return this._valuesPromise;
        }

        _includeOrExcludeBlock(checked = false) {
                if (this._exclude === undefined) {
                        this._exclude = htmlElement("input", {type:"checkbox", name: this.name+"-", class:"includeexclude"});
                        this._exclude.checked = checked;
                        this._exclude.addEventListener("change", () => {
                                if (this.isFiltering())
                                        this._onChange();
                        });
                }
                const label = htmlElement("label");
                label.appendChild(this._exclude);
                label.appendChild(htmlElement("span"));
                return label;
        }

        _inputBlocks(initialValue) {
                this._valuesLabelBlock = htmlElement("span", {id: this.name + "_labels"});

                if (this._input === undefined) {
                        this._input = this._selector(initialValue.selection, initialValue.selection);
                        this._input.addEventListener("click", () => this._values());
                        this._values();
                        this._resetValuesLabelAndSelectValue();
                } else {
                        this._setSelection(initialValue.selection ?? []);
                }

                return [this._includeOrExcludeBlock(initialValue.exclude),
                        this._input,
                        this._valuesLabelBlock];
        }

        valueFromURL(searchParams) {
                let values = [];
                try {
                        values = JSON.parse(searchParams.get(this.name));
                } catch(e) {
                        values = [];
                }
                if (!(values instanceof Array))
                        values = [];
                for (const v of values) {
                        if (!(typeof v == "string"))
                            values = [];
                }
                return {selection: values, exclude: searchParams.has(this.name+"-")};
        }

        unselect() {
                this._valuesPromiseController.abort();
                return super.unselect();
        }

        _setSelection(selection) {
                const existingOptions = this._options.map(o => o.value);
                selection.filter(v => !existingOptions.includes(v))
                        .forEach(v => this._newOption(v));
                this._options.forEach(o => o.classList.toggle("selected", selection.includes(o.value)));
                this._resetValuesLabelAndSelectValue();
        }

        setValue(newValue) {
                if (!this.isSelected())
                        return this.select(newValue);

                this._exclude.checked = newValue.exclude;
                this._setSelection(newValue.selection);
                this._onChange();
                return;
        }

        excludeValue(newValue) {
                if (!this.isSelected())
                        return this.select(newValue);

                if(this._exclude.checked) {
                        const newSelection = this._options.filter(o => o.classList.value == "selected").map(o => o.value);
                        newSelection.push(...newValue.selection);
                        this._setSelection(newSelection);
                } else {
                        this._exclude.checked = true;
                        this._setSelection(newValue.selection);
                }

                this._onChange();
                return;
        }

        _valueDetailsFromString(value, blockTag) {
                const block = htmlElement(blockTag, {}, value);
                block.appendChild(clickableIcon("🔎", () => this.setValue({selection: [value], exclude: false}), "Select entries where " + this.name +  " = " + value));
                block.appendChild(clickableIcon("×", () => this.excludeValue({selection: [value], exclude: true}), "Select entries where " + this.name +  " ≠ " + value, "remove"));
                return block;
        }

        valueToEntriesQuery(searchParams) {
                if (!this.isFiltering())
                        return;

                const selectedValues = this._options
                        .filter(o => o.classList.contains("selected"))
                        .map(o => o.value);

                if (!this._exclude.checked) {
                        selectedValues.forEach(value => searchParams.append(this.name, value));
                        return;
                }
                return this._values().then(values => {
                                const otherValues = values.filter(v => !selectedValues.includes(v));
                                if (otherValues.length == 0)
                                        searchParams.append(this.name, "__INVALID_VALUE__");
                                else
                                        otherValues.forEach(value => searchParams.append(this.name, value));
                                return;
                        });
        }
}
class RealtimeFilter extends Filter {
        _mindate;
        _maxdate;
        defaultValue = {date: "", time: ""};

        _onMachineInfoReceive(machineInfo) {
                if (!("cutoff_from_realtime" in machineInfo && "cutoff_to_realtime" in machineInfo))
                        return;

                const minDate = new Date(machineInfo.cutoff_from_realtime / 1000);
                const maxDate = new Date(machineInfo.cutoff_to_realtime / 1000);
                this._input.date.setAttribute("min", minDate.toLocaleDateString("fr-ca"));
                this._input.date.setAttribute("max", maxDate.toLocaleDateString("fr-ca"));
                return;
        }

        toTimestamp() {
                if (!this._input || this._input.date.value == "" || this._input.time.value  == "")
                        return null;

                const date = new Date(this._input.date.value  + " " + this._input.time.value);
                const timestamp = date.getTime();

                if (isNaN(timestamp))
                        return null;
                else
                        return timestamp / 1000;
        }

        isValidDate() {
                return this.toTimestamp() !== null;
        }

        _onDateTimeChange() {
                if (!this.isValidDate())
                        return;

                return this._onChange();
        }

        _valueFromMicroTimestamp(microTimestamp) {
                if (!microTimestamp || isNaN(microTimestamp))
                        return {date: "", time: ""};

                const date = new Date(microTimestamp / 1000);
                return {date: date.toLocaleDateString("fr-ca"), time: date.toLocaleTimeString("fr-fr")};
        }

        setValue(microTimestamp = null) {
                if (!this.isSelected())
                        return this.select(this._valueFromMicroTimestamp(microTimestamp));

                const value = this._valueFromMicroTimestamp(microTimestamp);
                this._input.date.value = value.date;
                this._input.time.value = value.time;
        }

        _inputBlocks(initialValue) {
                this._input = {
                        date: htmlElement("input", {type: "date", name: this.name + "-date", value: initialValue.date}),
                        time: htmlElement("input", {type: "time", name: this.name + "-time", value: initialValue.time, step: 1}),
                }
                this._input.date.addEventListener("change", () => this._onDateTimeChange());
                this._input.time.addEventListener("change", () => this._onDateTimeChange());

                fetch("machine")
                        .then(validateResponseStatus)
                        .then(response => response.json())
                        .then(machineInfo => this._onMachineInfoReceive(machineInfo))
                        .catch(e => console.warn(e));

                return [document.createTextNode(" ≥ "),
                        this._input.date,
                        this._input.time];
        }

        isFiltering() {
                return this.isValidDate();
        }

        valueFromURL(searchParams) {
                const initialValue = {date: searchParams.get(this.name+"-date"), time: searchParams.get(this.name+"-time")};
                if (typeof initialValue.date == "string" && typeof initialValue.time == "string") {
                        const date = new Date(initialValue.date + " " + initialValue.time);
                        if (date.toString() != "Invalid Date")
                                return initialValue;
                }
                return this.defaultValue;
        }

        _valueDetailsFromString(value, blockTag) {
                const date = new Date(parseInt(value) / 1000);
                if (date.toString() == "Invalid Date")
                        return document.createTextNode(value);

                const block = htmlElement(blockTag, {title: value}, date.toLocaleString() + "." + (value % 1000).toString().padStart(3, 0));
                block.appendChild(clickableIcon("🔎", () => this.setValue(value), "Select entries where " + this.name +  " ≥ " + date.toLocaleString()));
                return block;
        }

        valueToEntriesQuery(searchParams) {
                /* time is not used for query parameters, but for Range header */
                return ;
        }
}

class Journal {
        _block = document.getElementById("journal");
        _loadingArrow = document.getElementById("loading_arrow");
        _controller = new AbortController();
        _onChange;
        _fieldsCallback;
        _stream;

        constructor(onChange, fieldsCallback) {
                this._onChange = event => onChange(event);
                this._fieldsCallback = fields => fieldsCallback(fields);
                window.addEventListener("beforeunload", () => this.stopStream());
        }

        _reset() {
                this._controller.abort();
                this._controller = new AbortController();
                this.stopStream();
        }

        _startStream(url, nlines, onError) {
                this._stream = new EventSource(url);
                this._loadingArrow.style.display = "block";
                this._stream.addEventListener("error", err => {
                        connectionError();
                        console.error("EventSource failed:", err);
                        onError();
                        this._loadingArrow.style.display = "none";
                });
                this._stream.addEventListener("message", event => {
                        this._loadingArrow.style.display = "none";
                        this._displayEntry(event.data, nlines);
                });
        }

        stopStream() {
                if (typeof this._stream !== "undefined" && this._stream.readyState != 2)
                        this._stream.close();
        }

        _clear () {
                while (this._block.lastChild)
                        this._block.removeChild(this._block.lastChild);

                clearEntriesError();
        }

        _displayEntry(entryJSON, nlines) {
                let entry = {};
                try {
                        entry = JSON.parse(entryJSON);
                } catch {
                        return;
                }
                if (entry.MESSAGE === undefined || entry.__CURSOR == undefined)
                        return;

                this._fieldsCallback(Object.keys(entry));

                const line = htmlElement("tr", {"data-cursor": entry.__CURSOR});

                const checkbox = htmlElement("input", {type: "checkbox", name: "entry", value: entry.__CURSOR, id: "chk-" + entry.__CURSOR, "data-entry": entryJSON});
                checkbox.addEventListener("change", event => this._onChange(event));
                line.appendChild(checkbox);

                line.appendChild(htmlElement("td", {class: "timestamp"}, TimeField.valueInterpreted(entry.__REALTIME_TIMESTAMP ?? "")));
                line.appendChild(htmlElement("td", {}, Field.valueInterpreted(entry._HOSTNAME ?? "")));

                const process = htmlElement("td");
                if (entry.SYSLOG_IDENTIFIER != undefined)
                        process.textContent += Field.valueInterpreted(entry.SYSLOG_IDENTIFIER);
                else if (entry._COMM != undefined)
                        process.textContent += Field.valueInterpreted(entry._COMM);

                if (entry._PID != undefined)
                        process.textContent += "[" + Field.valueInterpreted(entry._PID) + "]";
                else if (entry.SYSLOG_PID != undefined)
                        process.textContent += "[" + Field.valueInterpreted(entry.SYSLOG_PID) + "]";

                line.appendChild(process);

                let clazz;
                let priority = parseInt(entry.PRIORITY ?? "6");
                if (isNaN(priority))
                        priority = 6;
                if (priority <= 3)
                        clazz = "message-error";
                else if (priority <= 5)
                        clazz = "message-highlight";
                else
                        clazz = "message";

                const message = htmlElement("td", {class: clazz});
                message.appendChild(htmlElement("label", {for: "chk-" + entry.__CURSOR}, Field.valueInterpreted(entry.MESSAGE, 256)));

                line.appendChild(message);
                journal.appendChild(line);
                while (journal.childNodes.length > nlines)
                        journal.removeChild(journal.firstChild);
                return;
        }

        _displayEntries(entriesText) {
                const entries = entriesText.split(/[\x1E\x0A]/).filter(t => t != "");
                this._clear();

                if (entries.length == 0)
                        return noEntriesError();

                entries.forEach(entry => this._displayEntry(entry));
                return;
        }

        entries() {
                return Array.from(this._block.childNodes).map(t => JSON.parse(t.firstChild.dataset.entry));
        }

        firstCursor() {
                if (this._block.firstChild == null || typeof this._block.firstChild.getAttribute == "undefined")
                        return null;

                return this._block.firstChild.dataset.cursor;
        }

        lastCursor() {
                if (this._block.firstChild == null || typeof this._block.firstChild.getAttribute == "undefined")
                        return null;

                return this._block.lastChild.dataset.cursor;
        }

        currentPosition() {
                let offset = Array.from(this._block.childNodes).findIndex(line => line.firstChild.checked);
                if (offset == -1)
                        return {cursor: this.firstCursor(), offset: null};
                else
                        return {cursor: this._block.childNodes[offset].dataset.cursor, offset: -offset};
        }

        follow(entriesSearchParams, nlines, onError) {
                entriesSearchParams.append("follow", 1);
                entriesSearchParams.append("lines", nlines);
                this._reset();
                this._clear();
                return this._startStream("entries?" + entriesSearchParams.toString(), nlines, onError);
        }

        loadStatic(entriesSearchParams, range, nlines) {
                this._reset();
                this._loadingArrow.style.display = "block";
                return fetch("entries?" + entriesSearchParams.toString(),
                        {headers: new Headers({Range: range, Accept: "application/json"}), signal: this._controller.signal})
                        .then(validateResponseStatus)
                        .then(response => response.text())
                        .then(text => this._displayEntries(text, nlines))
                        .finally(() => this._loadingArrow.style.display = "none");
        }
}
class Details {
        _block = document.getElementById("details");
        _fields = [];

        addField(field) {
                this._fields.push(field);

                const line = htmlElement("tr", {id: "field_" + field.name});
                line.appendChild(htmlElement("td", {class: "field"}, field.name));
                this._block.appendChild(line);

                let ncol = Math.max(...Array.from(this._block.children).map(line => line.children.length));
                while (ncol-- > 1)
                        line.appendChild(htmlElement("td"));
        }

        removeField(field) {
                this._block.children["field_"+field.name].remove();
                this._fields = this._fields.filter(f => f.name != field.name);
        }

        hide() {
                this._block.style.display = "none";
        }

        show() {
                this._block.style.display = "block";
        }

        clear() {
                this.hide();
                document.getElementsByName("entry").forEach(chk => chk.checked = false);
                Array.from(this._block.children).forEach(line => {
                        while (line.children.length > 1)
                                line.removeChild(line.lastChild);
                });
        }

        removeColumn(index) {
                Array.from(this._block.children).forEach(line => line.removeChild(line.children[index + 1]));
        }

        _displayFieldEntry(entry, field, index) {
                let cell = htmlElement("td");
                if (entry[field.name] !== undefined)
                        cell = field.valueDetails(entry[field.name]);

                this._block.children["field_"+field.name].children[index].insertAdjacentElement("afterend", cell);
        }

        displayEntry(entry, index) {
                return this._fields.forEach(f => this._displayFieldEntry(entry, f, index));
        }
}

class Controls {
        _form = document.forms.control;
        _filterList = document.getElementById("filterList");
        _fieldsListPromise = null;
        _fieldsListPromiseRejected = false;
        _details;
        _journal;
        _fields = {};

        _setBrowserURL() {
                const sp = new URLSearchParams(new FormData(this._form));
                const url = "browse?"+sp.toString();
                history.pushState(url, "", url);
                return sp;
        }

        _setPosition(position) {
                function setOrRemove(form, entity, value) {
                        if (value === null) {
                                if (entity in form)
                                        form.removeChild(form[entity]);

                                return;
                        }
                        if (entity in form)
                                form[entity].value = value;
                        else
                                form.appendChild(htmlElement("input", {type: "hidden", name: entity, value: value}));
                        return;
                }
                this._form.follow.checked = false;
                this._journal.stopStream();
                setOrRemove(this._form, "cursor", position.cursor ?? null);
                setOrRemove(this._form, "offset", position.offset ?? null);

                if (this._fields.__REALTIME_TIMESTAMP
                    && this._fields.__REALTIME_TIMESTAMP.isSelected()
                    && (position.cursor !== null || position.offset !== null))
                        this._fields.__REALTIME_TIMESTAMP.setValue(null);
        }

        _fixPosition() {
                this._form.follow.checked = false;
                if (!this._fields.__REALTIME_TIMESTAMP.isValidDate())
                        this._setPosition(this._journal.currentPosition());

                this._setBrowserURL();
        }

        _clearPosition() {
                if ("cursor" in this._form)
                        this._form.removeChild(this._form.cursor);

                if ("offset" in this._form)
                        this._form.removeChild(this._form.offset);

                if (this._fields.__REALTIME_TIMESTAMP
                    && this._fields.__REALTIME_TIMESTAMP.isValidDate())
                        this._fields.__REALTIME_TIMESTAMP.setValue(null);
        }

        _onEntryChange(event) {
                const checkbox = event.target;
                let selectedCursors;
                if (this._form.entry instanceof HTMLInputElement)
                        selectedCursors = [checkbox.value];
                else
                        selectedCursors = Array.from(this._form.entry)
                                .filter(e => e.checked || e.value == checkbox.value)
                                .map(e => e.value);

                const index = selectedCursors.indexOf(checkbox.value);
                this._fixPosition();
                if (checkbox.checked == false) {
                        if (selectedCursors.length == 1)
                                this._details.hide();

                        this._details.removeColumn(index);
                } else {
                        this._details.show();
                        return this._details.displayEntry(JSON.parse(checkbox.dataset.entry), index);
                }
        }

        _reselectEntries(cursors) {
                this._details.clear();

                let cursorsNotFound = [];
                let found = [];
                cursors.forEach(c => {
                        const chk = document.getElementById("chk-" + c);
                        if (chk)
                                found.push(chk);
                        else
                                cursorsNotFound.push(c);
                });
                if (found.length > 0) {
                        found.forEach((c, index) => {
                                c.checked = true;
                                this._details.displayEntry(JSON.parse(c.dataset.entry), index);
                        });
                        this._details.show();
                }
                if (cursorsNotFound.length > 0) {
                        cantFindEntriesError(cursorsNotFound);
                }
                this._fixPosition();
        }

        _selectedEntries() {
                if (this._form.follow.checked || !this._form.entry)
                        return [];
                if (this._form.entry instanceof HTMLElement) {
                        if (this._form.entry.checked)
                                return [this._form.entry.value];
                        else
                                return [];
                }
                return Array.from(this._form.entry)
                        .filter(checkbox => checkbox.checked)
                        .map(checkbox => checkbox.value);
        }

        _unselectAllEntries() {
                this._details.clear();
                if (this._form.entry instanceof HTMLElement)
                        return this._form.entry.checked = false;
                else if (this._form.entry instanceof RadioNodeList)
                        return Array.from(this._form.entry).map(checkbox => checkbox.checked = false);
        }

        loadNextEntries() {
                if (!this._form.follow.checked) {
                        this._setPosition({cursor: this._journal.lastCursor(), offset: 1});
                        this._unselectAllEntries();
                        return this.reloadJournal();
                }
        }

        loadPreviousEntries() {
                this._setPosition({cursor: this._journal.firstCursor(), offset: -this._form.lines.value});
                this._unselectAllEntries();
                return this.reloadJournal();
        }

        loadEntriesHead() {
                this._setPosition({cursor: "", offset: null});
                this._unselectAllEntries();
                return this.reloadJournal();
        }

        loadEntriesTail() {
                if (!this._form.follow.checked) {
                        this._setPosition({cursor: "", offset: 1-this._form.lines.value});
                        this._unselectAllEntries();
                        return this.reloadJournal();
                }
        }

        entriesMore() {
                this._form.lines.value = Math.max(10, Math.min(1000, Number(this._form.lines.value)+10));
                return this.reloadJournal();
        }

        entriesLess() {
                this._form.lines.value = Math.max(10, Math.min(1000, Number(this._form.lines.value)-10));
                return this.reloadJournal();
        }

        copyPosition() {
                navigator.clipboard.writeText(document.location.toString());
        }

        toggleFollow() {
                const follow = this._form.follow;
                follow.checked = !follow.checked;
                document.getElementById("followbtn").title = follow.checked ? "Pause" : "Play";
                if (follow.checked) {
                        this._clearPosition();
                        this._unselectAllEntries();
                        this.reloadJournal();
                } else {
                        this._fixPosition();
                }
        }

        _getRange() {
                if (this._fields.__REALTIME_TIMESTAMP) {
                        const timestamp = this._fields.__REALTIME_TIMESTAMP.toTimestamp();
                        if (timestamp !== null)
                                return "time=" + timestamp + "::" + this._form.lines.value;
                }

                let range = "entries=";
                if ("cursor" in this._form)
                        range += this._form.cursor.value;

                if ("offset" in this._form)
                        range += ":" + this._form.offset.value;

                range += ":" + this._form.lines.value;
                return range;
        }

        _fetchError(error) {
                switch (error.name) {
                        case "AbortError":
                                return;
                                break;
                        case "TypeError":
                                connectionError();
                                break;
                        default:
                                appError();
                                break;
                }
                console.error(error);
        }

        reloadJournal() {
                const searchParams = new URLSearchParams();
                this._setBrowserURL();
                return Promise.all(Object.values(this._fields)
                                .filter(f => f.filterable && f.isSelected())
                                .map(f => f.valueToEntriesQuery(searchParams)))
                        .then(() => this._onEntriesSearchParamsReady(searchParams))
                        .catch(error => this._fetchError(error));
        }

        _encodeCSV(text) {
                if (text.indexOf(",") == -1 && text.indexOf("\n") == -1 && text.indexOf("\"") == -1)
                        return text;

                return "\"" + text.replaceAll("\"", "\"\"") + "\"";
        }

        downloadCSV() {
                let csv = Object.keys(this._fields).join(",") + "\n";
                csv += this._journal.entries().map(entry =>
                        Object.values(this._fields)
                                .map(f => this._encodeCSV(Field.valueCSV(entry[f.name] ?? "")))
                                .join(",")
                        ).join("\n");
                document.getElementById("downloadCSV").href = "data:text/csv;charset=utf-8,\uFEFF" + encodeURI(csv);
        }

        _onEntriesSearchParamsReady(entriesSearchParams) {
                if (this._form.follow.checked) {
                        return this._journal.follow(entriesSearchParams, this._form.lines.value, () => this._fixPosition());
                } else {
                        const selectedEntries = this._selectedEntries();
                        return this._journal.loadStatic(entriesSearchParams, this._getRange(), this._form.lines.value)
                                .then(() => this._reselectEntries(selectedEntries));
                }
        }

        _newField(fieldName) {
                if (fieldName in this._fields)
                        return;

                let field;
                switch (fieldName) {
                        case "MESSAGE":
                                field = new Filter(fieldName, () => this.reloadJournal());
                                break;
                        case "PRIORITY":
                                field = new PriorityFilter(fieldName, () => this.reloadJournal());
                                break;
                        case "__REALTIME_TIMESTAMP":
                                field = new RealtimeFilter(fieldName, () => {
                                        this._fixPosition();
                                        this.reloadJournal();
                                });
                                break;
                        case "__CURSOR":
                        case "__MONOTONIC_TIMESTAMP":
                                field = new Field(fieldName);
                                break;
                        default:
                                if (fieldName.endsWith("TIMESTAMP"))
                                        field = new TimeField(fieldName);
                                else if (fieldName.endsWith("UID") || fieldName.endsWith("GID") || fieldName.endsWith("PID"))
                                        field = new IdFilter(fieldName, () => this.reloadJournal());
                                else
                                        field = new MultiSelectFilter(fieldName, () => this.reloadJournal());

                                break;
                }

                this._fields[fieldName] = field;
                this._details.addField(field);
                if (field.filterable)
                        insertOptionAlphabeticallyByLabel(this._filterList, field.option);
        }

        _newFields(fieldNames) {
                fieldNames.forEach(f => this._newField(f));
        }

        _removeField(field) {
                if (field.filterable)
                        field.option.remove();

                this._details.removeField(field);
                delete this._fields[field.name];
        }

        _initWithDefaultFilters() {
                ["__REALTIME_TIMESTAMP", "_HOSTNAME", "SYSLOG_IDENTIFIER", "PRIORITY"]
                        .map(fieldName => {
                                this._newField(fieldName);
                                this._fields[fieldName].select(this._fields[fieldName].defaultValue);
                        });
        }

        _initFiltersFromURL(searchParams) {
                let selectedEntries = [];
                this._form.follow.checked = searchParams.has("follow");
                for (let [key, val] of searchParams.entries()) {
                        switch(key) {
                                case "lines":
                                        this._form.lines.value = val;
                                        break;
                                case "cursor":
                                        this._form.appendChild(htmlElement("input", {type: "hidden", name: "cursor", value: val}));
                                        break;
                                case "offset":
                                        this._form.appendChild(htmlElement("input", {type: "hidden", name: "offset", value: val}));
                                        break;
                                case "entry":
                                        selectedEntries.push(val);
                                        break;
                                case "follow":
                                        break;
                                default:
                                        let pos;
                                        if ((pos = key.indexOf("-")) >= 0)
                                                key = key.slice(0, pos);

                                        if (!this._fields[key])
                                                this._newField(key);

                                        if (!this._fields[key].isSelected())
                                                this._fields[key].select(this._fields[key].valueFromURL(searchParams));

                                        break;
                        }
                }
                return selectedEntries;
        }

        _onFieldListReceive(fieldNames) {
                const missingFilters = Object.values(this._fields)
                        .filter(f => f.filterable)
                        .filter(f => !fieldNames.includes(f.name) && f.name != "__REALTIME_TIMESTAMP");

                const selectedMissingFilters = missingFilters.filter(f => f.isSelected());

                if (selectedMissingFilters.length > 0) {
                        const filteringMissingFilters = selectedMissingFilters.filter(f => f.isFiltering());
                        if (filteringMissingFilters.length > 0)
                                filterNoExistError(filteringMissingFilters.map(f => f.name));

                        selectedMissingFilters.forEach(f => f.unselect());
                }
                missingFilters.forEach(f => this._removeField(f));

                this._newFields(fieldNames);
        }

        _onKeyUp(event) {
                if (event.target.tagName == "INPUT")
                        return;
                switch (event.keyCode) {
                        case 8:
                        case 37:
                        case 75:
                                this.loadPreviousEntries();
                                break;
                        case 39:
                        case 74:
                                this.loadNextEntries();
                                break;
                        case 71:
                                if (event.shiftKey)
                                        this.loadEntriesTail();
                                else
                                        this.loadEntriesHead();
                                break;
                        case 107:
                                this.entriesMore();
                                break;
                        case 109:
                                this.entriesLess();
                                break;
                        case 32:
                        case 80:
                                this.toggleFollow();
                                break;
                }
        }

        _fetchFields() {
                if (this._fieldsPromise == null || this._fieldsPromiseRejected) {
                        const loading = loadingOption();
                        this._filterList.add(loading);
                        this._fieldsPromiseRejected = false;
                        this._fieldsPromise = fetch("fields", {headers: new Headers({Accept: "application/json"})})
                                .then(validateResponseStatus)
                                .then(response => response.text())
                                .then(newlineSeparatedJson)
                                .then(fields => this._onFieldListReceive(fields))
                                .finally(() => loading.remove());
                        this._fieldsPromise.catch(() => this._fieldsPromiseRejected = true);
                }

                return this._fieldsPromise;
        }

        _installHandlers() {
                document.onkeyup = event => this._onKeyUp(event);
                this._form.lines.addEventListener("change", () => this.reloadJournal());
                this._form.entriesMore.addEventListener("click", () => this.entriesMore());
                this._form.entriesLess.addEventListener("click", () => this.entriesLess());
                this._form.loadEntriesHead.addEventListener("click", () => this.loadEntriesHead());
                this._form.loadPreviousEntries.addEventListener("click", () => this.loadPreviousEntries());
                document.getElementById("downloadCSV").addEventListener("click", () => this.downloadCSV(), true);
                this._form.followbtn.addEventListener("click", () => this.toggleFollow());
                this._form.copyPosition.addEventListener("click", () => this.copyPosition());
                if (!navigator.clipboard)
                        this._form.copyPosition.remove();
                this._form.loadNextEntries.addEventListener("click", () => this.loadNextEntries());
                this._form.loadEntriesTail.addEventListener("click", () => this.loadEntriesTail());
                Array.from(document.getElementsByClassName("reloadJournal")).forEach(
                        e => e.addEventListener("click", () => this.reloadJournal())
                );
        }

        constructor() {
                this._details = new Details();

                const searchParams = (new URL(window.location)).searchParams;
                this._newField("__REALTIME_TIMESTAMP");
                let selectedEntries = [];
                if (searchParams.toString().length == 0)
                        this._initWithDefaultFilters();
                else
                        selectedEntries = this._initFiltersFromURL(searchParams);
                this._newField("__MONOTONIC_TIMESTAMP");
                this._newField("__CURSOR");

                this._filterList.addEventListener("change", event => {
                        this._fields[event.target.value].toggleSelect()
                        this._filterList.selectedIndex = 0;
                });
                this._filterList.addEventListener("click", () => this._fetchFields());
                this._fetchFields();

                this._journal = new Journal(event => this._onEntryChange(event), fields => this._newFields(fields));

                this._form.addEventListener("submit", event => {
                        event.preventDefault();
                        this.reloadJournal();
                        return false;
                });
                this._installHandlers();

                if (selectedEntries.length)
                        this.reloadJournal().then(() => this._reselectEntries(selectedEntries));
                else
                        this.reloadJournal();
        }
}

document.addEventListener("DOMContentLoaded", () => {
        new Controls();
        Array.from(document.getElementsByClassName("errorbox")).forEach(
                box => box.addEventListener("click", event => event.currentTarget.style.display = "none")
        );
});
