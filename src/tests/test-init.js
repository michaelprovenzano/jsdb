class WaffleValidator {
	constructor(value, waffleTest) {
		this.value = value;
		this.waffleTest = waffleTest;
        this.isNot = false;

        // this.not = this.not.bind(this);
	}
	
    toEqual(value) {
        let result = this.checkNot(this.value === value);
        this.checkWaffleTest(result);
        return result;
    }
	toBe(value) {
		let result = this.checkNot(this.value === value)
		this.checkWaffleTest(result);
		
		return result;
	}
	toBeGreaterThan(value) {
		let result = this.checkNot(this.value > value)
		this.checkWaffleTest(result);
		
		return result;
	}
	toBeGreaterThanOrEqual(value) {
		let result = this.checkNot(this.value >= value)
		this.checkWaffleTest(result);
		
		return result;
	}
	toBeLessThan(value) {
		let result = this.checkNot(this.value < value)
		this.checkWaffleTest(result);
		
		return result;
	}
	toBeLessThanOrEqual(value) {
		let result = this.checkNot(this.value <= value)
		this.checkWaffleTest(result);
		
		return result;
	}
	toBeNull() {
		let result = this.checkNot(this.value === null);
		this.checkWaffleTest(result);
		
		return result;
	}
	toBeUndefined() {
		let result = this.checkNot(this.value === undefined)
		this.checkWaffleTest(result);
		
		return result;
	}
	toBeNaN() {
		let result = this.checkNot(Number.isNaN(this.value));
		this.checkWaffleTest(result);
		
		return result;
	}
	not() {
		this.isNot = true;
		return this;
	}
	checkNot(value) {
		if (this.isNot) return !value;
		return value;
	}
	checkWaffleTest(result) {
		if (this.waffleTest) this.waffleTest.currentTest().results.push(result);
	}
}

class WaffleTests {
	constructor(opts) {
		if (!opts) opts = {};

		this.tests = [];
		this.test = this.test.bind(this);
		this.environment = opts.environment || 'BROWSER'

		if (this.environment === 'NODE') {
			this.message = {
				success: function (msg) {
					console.log('\x1b[32m%s\x1b[0m', 'PASS | TEST | ' + msg)
				},
				fail: function (msg) {
					console.log('\x1b[31m%s\x1b[0m', 'FAIL | TEST | ' + msg)
				}
			}
		}

		if (this.environment === 'BROWSER') {
			this.message = {
				success: function (msg) {
					console.log(`%cPASS | TEST | ${msg}`, 'color: green; font-weight: bold;');
				},
				fail: function (msg) {
					console.log(`%cFAIL | TEST | ${msg}`, 'color: red; font-weight: bold;');
				}
			}
		}
	}
	
	test(msg, cb) {
		this.tests.push({ logs: [], results: [] });
		cb();
		
		if (this.currentTest().results.includes(true)) this.message.success(msg);
		if (!this.currentTest().results.includes(true)) this.message.fail(msg);
		
		let test = this.tests[this.tests.length-1];
		test.logs.forEach(log => {
			console[log.type](log.message);
		});
	}
	
	currentTest() {
		return this.tests[this.tests.length-1];
	}
	
	console(message, type) {
		this.currentTest().logs.push({ message, type });		
	}
	
	log(message) {
		this.console(message, 'log');
	}
	
	warn(message) {
		this.console(message, 'warn');
	}
	
	error(message) {
		this.console(message, 'error');
	}
	
	expect(value) {
		return new WaffleValidator(value, this);
	}
}

module.exports = WaffleTests