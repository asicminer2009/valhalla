'use babel';

export default class SuperValaView {

    constructor(serializedState, type, exitCmd, title, cb) {
        // Create root element
        this.element = document.createElement('div');
        this.element.classList.add('super-vala');

        // Create message element
        const message = document.createElement('h1');
        message.textContent = title;
        message.classList.add('message');

        const warning = document.createElement('div');
        warning.classList.add('text-error');
        warning.textContent = 'Warning : there is an invalid character in your ' + type + ' name.';
        warning.style.display = 'none';

        const input = document.createElement('atom-text-editor');
        input.setAttribute('mini', true);
        input.setAttribute('placeholder-text', 'MyNew' + type.charAt(0).toUpperCase() + type.slice(1));

        input.addEventListener('keyup', (event) => {
            if (input.getModel().getText().match(/[^\w<>]/)) {
                warning.style.display = 'block';
            } else {
                warning.style.display = 'none';
            }

            // esc
            if (event.keyCode == 27) {
                atom.commands.dispatch(input, 'super-vala:' + exitCmd); // toggle the modal panel
            }

            //enter
            if (event.keyCode == 13) {
                cb(input.getModel().getText());
                atom.commands.dispatch(input, 'super-vala:' + exitCmd); // toggle the modal panel
            }
        });
        input.focus();

        this.element.appendChild(message);
        this.element.appendChild(input);
        this.element.appendChild(warning);
    }

    // Returns an object that can be retrieved when package is activated
    serialize() {}

    // Tear down any state and detach
    destroy() {
        this.element.remove();
    }

    getElement() {
        return this.element;
    }

}
