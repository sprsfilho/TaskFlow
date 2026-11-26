// Espera o HTML carregar antes de rodar (funciona mesmo com o <script> no <head>)
document.addEventListener("DOMContentLoaded", () => {

    // ELEMENTOS HTML

    const taskForm = document.getElementById("taskForm");
    const taskTitle = document.getElementById("taskTitle");
    const taskDescription = document.getElementById("taskDescription");
    const taskPriority = document.getElementById("taskPriority");
    const searchInput = document.getElementById("searchInput");
    const totalTasks = document.getElementById("totalTasks");

    const columns = {
        todo: document.getElementById("todoList"),
        progress: document.getElementById("progressList"),
        done: document.getElementById("doneList")
    };

    // Avisa no console se algum id do HTML não bater com o JS
    const required = {
        taskForm, taskTitle, taskDescription, taskPriority, searchInput,
        todoList: columns.todo, progressList: columns.progress, doneList: columns.done
    };
    const missing = Object.keys(required).filter(key => !required[key]);
    if (missing.length) {
        console.error("Elementos não encontrados no HTML (confira os ids):", missing.join(", "));
        return;
    }

    // DADOS

    const STORAGE_KEY = "taskflow_tasks";
    let tasks = [];

    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (Array.isArray(saved)) {
            // Normaliza tarefas antigas/incompletas para não quebrar a renderização
            tasks = saved
                .filter(task => task && task.id && task.title)
                .map(task => ({
                    id: String(task.id),
                    title: String(task.title),
                    description: task.description ? String(task.description) : "",
                    priority: ["low", "medium", "high"].includes(task.priority) ? task.priority : "medium",
                    status: ["todo", "progress", "done"].includes(task.status) ? task.status : "todo"
                }));
        }
    } catch (error) {
        console.error("Erro ao carregar tarefas:", error);
        tasks = [];
    }

    let draggedTaskId = null;

    // LOCALSTORAGE

    function saveTasks() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
        } catch (error) {
            console.error("Erro ao salvar tarefas:", error);
            alert("Não foi possível salvar as tarefas neste navegador.");
        }
    }

    // GERAR ID (crypto.randomUUID só existe em HTTPS/localhost)

    function generateId() {
        if (window.crypto && typeof crypto.randomUUID === "function") {
            return crypto.randomUUID();
        }
        return Date.now().toString(36) + Math.random().toString(36).slice(2);
    }

    // CRIAR TAREFA

    function addTask(title, description, priority) {
        tasks.push({
            id: generateId(),
            title,
            description,
            priority: priority || "medium",
            status: "todo"
        });

        saveTasks();
        renderTasks();
    }

    // EVENTO DO FORMULÁRIO

    taskForm.addEventListener("submit", event => {
        event.preventDefault();

        const title = taskTitle.value.trim();
        const description = taskDescription.value.trim();
        const priority = taskPriority.value;

        if (!title) return;

        addTask(title, description, priority);

        taskForm.reset();
        taskTitle.focus();
    });

    // RENDERIZAR TAREFAS

    const priorityNames = {
        low: "BAIXA",
        medium: "MÉDIA",
        high: "ALTA"
    };

    function renderTasks() {
        Object.values(columns).forEach(column => {
            column.innerHTML = "";
        });

        const search = searchInput.value.toLowerCase();

        const filteredTasks = tasks.filter(task =>
            task.title.toLowerCase().includes(search) ||
            (task.description || "").toLowerCase().includes(search)
        );

        filteredTasks.forEach(task => {
            const card = document.createElement("article");
            card.className = "task-card";
            card.draggable = true;
            card.dataset.id = task.id;

            const title = document.createElement("h4");
            title.textContent = task.title;

            const description = document.createElement("p");
            description.textContent = task.description || "Sem descrição.";

            const priority = document.createElement("span");
            priority.className = `priority ${task.priority}`;
            priority.textContent = priorityNames[task.priority] || "MÉDIA";

            const actions = document.createElement("div");
            actions.className = "card-actions";

            // Botão "Começar" (só aparece em "A fazer")
            if (task.status === "todo") {
                const startButton = document.createElement("button");
                startButton.type = "button";
                startButton.textContent = "Começar";
                startButton.classList.add("start");
                startButton.addEventListener("click", () => moveTask(task.id, "progress"));
                actions.append(startButton);
            }

            // Botão "Concluir" verde (some quando a tarefa já está concluída)
            if (task.status !== "done") {
                const completeButton = document.createElement("button");
                completeButton.type = "button";
                completeButton.textContent = "Concluir";
                completeButton.classList.add("complete");
                completeButton.addEventListener("click", () => moveTask(task.id, "done"));
                actions.append(completeButton);
            }

            const editButton = document.createElement("button");
            editButton.type = "button";
            editButton.textContent = "Editar";
            editButton.addEventListener("click", () => editTask(task.id));

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.textContent = "Excluir";
            deleteButton.classList.add("delete");
            deleteButton.addEventListener("click", () => deleteTask(task.id));

            actions.append(editButton, deleteButton);
            card.append(title, description, priority, actions);

            // DRAG AND DROP

            card.addEventListener("dragstart", event => {
                draggedTaskId = task.id;
                event.dataTransfer.setData("text/plain", task.id); // necessário no Firefox
                card.classList.add("dragging");
                card.style.opacity = "0.5";
            });

            card.addEventListener("dragend", () => {
                draggedTaskId = null;
                card.classList.remove("dragging");
                card.style.opacity = "1";
            });

            (columns[task.status] || columns.todo).appendChild(card);
        });

        // MENSAGENS DE COLUNAS VAZIAS

        Object.values(columns).forEach(column => {
            if (column.children.length === 0) {
                const emptyMessage = document.createElement("p");
                emptyMessage.className = "empty";
                emptyMessage.textContent = "Nenhuma tarefa aqui.";
                column.appendChild(emptyMessage);
            }
        });

        updateCounters();
    }

    // CONTADORES

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }

    function updateCounters() {
        if (totalTasks) totalTasks.textContent = tasks.length;
        setText("todoCount", tasks.filter(task => task.status === "todo").length);
        setText("progressCount", tasks.filter(task => task.status === "progress").length);
        setText("doneCount", tasks.filter(task => task.status === "done").length);
    }

    // MOVER TAREFA (usado pelos botões Começar e Concluir)

    function moveTask(id, newStatus) {
        const task = tasks.find(item => item.id === id);
        if (!task || !columns[newStatus]) return;

        task.status = newStatus;

        saveTasks();
        renderTasks();
    }

    // EXCLUIR TAREFA

    function deleteTask(id) {
        if (!confirm("Deseja excluir esta tarefa?")) return;

        tasks = tasks.filter(task => task.id !== id);

        saveTasks();
        renderTasks();
    }

    // EDITAR TAREFA

    function editTask(id) {
        const task = tasks.find(item => item.id === id);
        if (!task) return;

        const newTitle = prompt("Novo título:", task.title);
        if (newTitle === null) return;

        if (!newTitle.trim()) {
            alert("O título não pode ficar vazio.");
            return;
        }

        const newDescription = prompt("Nova descrição:", task.description);
        if (newDescription === null) return;

        task.title = newTitle.trim();
        task.description = newDescription.trim();

        saveTasks();
        renderTasks();
    }

    // PESQUISAR

    searchInput.addEventListener("input", renderTasks);

    // DRAG AND DROP NAS COLUNAS
    // Cada coluna precisa ter class="column" e data-status="todo" / "progress" / "done"

    document.querySelectorAll(".column").forEach(column => {
        column.addEventListener("dragover", event => {
            event.preventDefault();
            column.classList.add("drag-over");
        });

        column.addEventListener("dragleave", event => {
            if (!column.contains(event.relatedTarget)) {
                column.classList.remove("drag-over");
            }
        });

        column.addEventListener("drop", event => {
            event.preventDefault();
            column.classList.remove("drag-over");

            const newStatus = column.dataset.status;
            const id = draggedTaskId || event.dataTransfer.getData("text/plain");
            const task = tasks.find(item => item.id === id);

            if (!task || !columns[newStatus]) return;

            task.status = newStatus;

            saveTasks();
            renderTasks();
        });
    });

    // INICIALIZAÇÃO

    renderTasks();
});
