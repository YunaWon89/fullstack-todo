import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import './App.css'

const API_URL = '/api/todos'

const EMPTY_FORM = {
  title: '',
  description: '',
  priority: 'medium',
  dueDate: '',
}

function App() {
  const [todos, setTodos] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadTodos = useCallback(async () => {
    try {
      setError('')

      const response = await axios.get(API_URL)

      const data = Array.isArray(response.data.data)
        ? response.data.data
        : []

      setTodos(data)
    } catch (err) {
      console.error('Load todos error:', err)
      setError('Не удалось загрузить задачи')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const fetchTodos = async () => {
      await loadTodos()
    }

    fetchTodos()
  }, [loadTodos])

  const handleChange = (event) => {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const title = form.title.trim()

    if (!title) {
      setError('Введите название задачи')
      return
    }

    try {
      setSaving(true)
      setError('')

      const response = await axios.post(API_URL, {
        title,
        description: form.description.trim(),
        priority: form.priority,
        dueDate: form.dueDate || null,
      })

      const createdTodo = response.data

      if (!createdTodo || !createdTodo._id) {
        throw new Error('Backend returned invalid todo')
      }

      setTodos((current) => [
        createdTodo,
        ...current,
      ])

      setForm(EMPTY_FORM)
    } catch (err) {
      console.error('Create todo error:', err)
      setError('Не удалось создать задачу')
    } finally {
      setSaving(false)
    }
  }

  const toggleTodo = async (todo) => {
    try {
      setError('')

      const response = await axios.put(
        `${API_URL}/${todo._id}`,
        {
          completed: !todo.completed,
        },
      )

      const updatedTodo = response.data

      if (!updatedTodo || !updatedTodo._id) {
        throw new Error('Backend returned invalid todo')
      }

      setTodos((current) =>
        current.map((item) =>
          item._id === todo._id
            ? updatedTodo
            : item,
        ),
      )
    } catch (err) {
      console.error('Update todo error:', err)
      setError('Не удалось изменить задачу')
    }
  }

  const deleteTodo = async (id) => {
    try {
      setError('')

      await axios.delete(`${API_URL}/${id}`)

      setTodos((current) =>
        current.filter((todo) => todo && todo._id !== id),
      )
    } catch (err) {
      console.error('Delete todo error:', err)
      setError('Не удалось удалить задачу')
    }
  }

  return (
    <main className="app">
      <div className="container">

        <header className="header">
          <div>
            <p className="eyebrow">
              FULL-STACK TODO
            </p>

            <h1>My Tasks</h1>

            <p className="subtitle">
              React + Express + MongoDB + Redis + Docker
            </p>
          </div>

          <div className="counter">
            <strong>{todos.length}</strong>
            <span>tasks</span>
          </div>
        </header>

        <section className="card form-card">
          <h2>Add a task</h2>

          <form onSubmit={handleSubmit}>

            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="What needs to be done?"
              maxLength={200}
            />

            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Description (optional)"
              rows="3"
            />

            <div className="form-row">

              <select
                name="priority"
                value={form.priority}
                onChange={handleChange}
              >
                <option value="low">
                  Low priority
                </option>

                <option value="medium">
                  Medium priority
                </option>

                <option value="high">
                  High priority
                </option>
              </select>

              <input
                type="date"
                name="dueDate"
                value={form.dueDate}
                onChange={handleChange}
              />

              <button
                type="submit"
                disabled={saving}
              >
                {saving ? 'Adding...' : 'Add task'}
              </button>

            </div>
          </form>
        </section>

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        <section className="tasks">

          <div className="section-title">
            <h2>Tasks</h2>

            <button
              type="button"
              className="refresh"
              onClick={loadTodos}
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="empty">
              Loading tasks...
            </div>
          ) : todos.length === 0 ? (
            <div className="empty">
              No tasks yet. Add your first task above.
            </div>
          ) : (
            todos
              .filter(Boolean)
              .map((todo) => (
                <article
                  className={`task ${
                    todo.completed ? 'completed' : ''
                  }`}
                  key={todo._id}
                >

                  <button
                    type="button"
                    className="checkbox"
                    onClick={() => toggleTodo(todo)}
                    aria-label={
                      todo.completed
                        ? 'Mark as incomplete'
                        : 'Mark as complete'
                    }
                  >
                    {todo.completed ? '✓' : ''}
                  </button>

                  <div className="task-content">

                    <div className="task-header">

                      <h3>{todo.title}</h3>

                      <span
                        className={`priority ${todo.priority}`}
                      >
                        {todo.priority}
                      </span>

                    </div>

                    {todo.description && (
                      <p>{todo.description}</p>
                    )}

                    {todo.dueDate && (
                      <small>
                        Due:{' '}
                        {new Date(
                          todo.dueDate,
                        ).toLocaleDateString()}
                      </small>
                    )}

                  </div>

                  <button
                    type="button"
                    className="delete"
                    onClick={() => deleteTodo(todo._id)}
                  >
                    Delete
                  </button>

                </article>
              ))
          )}

        </section>

      </div>
    </main>
  )
}

export default App