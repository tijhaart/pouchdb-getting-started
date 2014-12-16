(function(window) {

  'use strict';

  var ENTER_KEY = 13;
  var newTodoDom = document.getElementById('new-todo');
  var syncDom = document.getElementById('sync-wrapper');

  // EDITING STARTS HERE (you dont need to edit anything above this line)

  var db = new PouchDB('todos');
  var remoteCouch = 'http://localhost:5984/todos';

  db.changes({
    since: 'now',
    live: true
  }).on('change', showTodos);

  function Todo(data, options) {
    _.defaults(this, data, {
      _id: new Date().toISOString(),
      title: null,
      completed: false
    });
    options = options || {};

    this.db = options.db;
  }
  Todo.prototype = {
    _id: void 0,
    _rev: void 0,
    title: void 0,
    completed: false
  };
  Todo.prototype.getData = function() {
    return {
      _id: this._id,
      _rev: this._rev,
      title: this.title,
      completed: this.completed
    };
  };
  Todo.prototype.complete = function(complete) {
    if (_(complete).isUndefined()) {
      return this.completed;
    } else {
      this.completed = !!complete;
    }
  };
  Todo.prototype.remove = function() {
    return this.db.remove({_id: this._id, _rev: this._rev});
  };
  Todo.prototype.save = function() {
    return this.db.put(this.getData());
  };
  Todo.prototype.toJSON = function() {
    return JSON.stringify(this.getData());
  };

  Todo.create = function(data) {
    return new Todo(data, {db: db});
  };
  Todo.list = function() {
    var promise = db.allDocs({include_docs: true, descending: true});
    promise.catch(function(err) {
      console.error(err);
    });
    return promise;
  };
  Todo.parse = function(data) {
    return this.create(data);
  };

  db.info(function(err, info) {
    db.changes({since: info.update_seq, onChange: showTodos, continuous: true});
  });

  // We have to create a new todo document and enter it in the database
  function addTodo(text) {
    var todo = Todo.create({
      title: text
    });

    db.put(todo.getData()).then(function(res) {
      console.debug(res);
    }).catch(function(err) {
      console.error(err);
    })
  }

  // Show the current list of todos by reading them from the database
  function showTodos() {
    Todo.list().then(function(doc) {
      console.debug(doc);
      redrawTodosUI(doc.rows);
    });
  }

  function checkboxChanged(todo, event) {
    console.debug(todo);
    todo = Todo.parse(todo);
    todo.complete(event.target.checked);
    todo.save();
  }

  // User pressed the delete button for a todo, delete it
  function deleteButtonPressed(todo) {
    todo = Todo.parse(todo);
    todo.remove();
  }

  // The input box when editing a todo has blurred, we should save
  // the new title or delete the todo if the title is empty
  function todoBlurred(todo, event) {
    todo = Todo.parse(todo);
    var trimmed = event.target.value.trim();
    if (_(trimmed).isEmpty()) {
      todo.remove();
    } else {
      todo.title = trimmed;
      todo.save();
    }
  }

  // Initialise a sync with the remote server
  function sync() {
    syncDom.setAttribute('data-sync-state', 'syncing');
    var opts = {live: true};
    db.replicate.to(remoteCouch, opts, syncError);
    db.replicate.from(remoteCouch, opts, syncError);
  }

  // EDITING STARTS HERE (you dont need to edit anything below this line)

  // There was some form or error syncing
  function syncError() {
    syncDom.setAttribute('data-sync-state', 'error');
  }

  // User has double clicked a todo, display an input so they can edit the title
  function todoDblClicked(todo) {
    var div = document.getElementById('li_' + todo._id);
    var inputEditTodo = document.getElementById('input_' + todo._id);
    div.className = 'editing';
    inputEditTodo.focus();
  }

  // If they press enter while editing an entry, blur it to trigger save
  // (or delete)
  function todoKeyPressed(todo, event) {
    if (event.keyCode === ENTER_KEY) {
      var inputEditTodo = document.getElementById('input_' + todo._id);
      inputEditTodo.blur();
    }
  }

  // Given an object representing a todo, this will create a list item
  // to display it.
  function createTodoListItem(todo) {
    var checkbox = document.createElement('input');
    checkbox.className = 'toggle';
    checkbox.type = 'checkbox';
    checkbox.addEventListener('change', checkboxChanged.bind(this, todo));

    var label = document.createElement('label');
    label.appendChild( document.createTextNode(todo.title));
    label.addEventListener('dblclick', todoDblClicked.bind(this, todo));

    var deleteLink = document.createElement('button');
    deleteLink.className = 'destroy';
    deleteLink.addEventListener( 'click', deleteButtonPressed.bind(this, todo));

    var divDisplay = document.createElement('div');
    divDisplay.className = 'view';
    divDisplay.appendChild(checkbox);
    divDisplay.appendChild(label);
    divDisplay.appendChild(deleteLink);

    var inputEditTodo = document.createElement('input');
    inputEditTodo.id = 'input_' + todo._id;
    inputEditTodo.className = 'edit';
    inputEditTodo.value = todo.title;
    inputEditTodo.addEventListener('keypress', todoKeyPressed.bind(this, todo));
    inputEditTodo.addEventListener('blur', todoBlurred.bind(this, todo));

    var li = document.createElement('li');
    li.id = 'li_' + todo._id;
    li.appendChild(divDisplay);
    li.appendChild(inputEditTodo);

    if (todo.completed) {
      li.className += 'complete';
      checkbox.checked = true;
    }

    return li;
  }

  function redrawTodosUI(todos) {
    var ul = document.getElementById('todo-list');
    ul.innerHTML = '';
    todos.forEach(function(todo) {
      ul.appendChild(createTodoListItem(todo.doc));
    });
  }

  function newTodoKeyPressHandler( event ) {
    if (event.keyCode === ENTER_KEY) {
      addTodo(newTodoDom.value);
      newTodoDom.value = '';
    }
  }

  function addEventListeners() {
    newTodoDom.addEventListener('keypress', newTodoKeyPressHandler, false);
  }

  addEventListeners();
  showTodos();

  if (remoteCouch) {
    sync();
  }

  window.Todo = Todo;
})(window);
