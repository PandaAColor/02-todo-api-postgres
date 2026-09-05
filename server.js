/**
 * 02 - TODO API con Postgres
 * Nivel: Intermedio
 *
 * Objetivo:
 * - Reemplazar el array en memoria de la practica 01 por persistencia real en Postgres
 * - Levantar Node + Postgres juntos con Docker Compose (dos contenedores, una red)
 * - Usar el driver "pg" con queries parametrizadas (evitar SQL injection)
 * - Comprobar que los datos sobreviven a un restart del contenedor de la API
 *   (mientras no se borre el volumen de Postgres)
 *
 * Requisitos previos: Docker y Docker Compose instalados.
 * Como correr esta practica: ver README.md
 */

import express from 'express'
import { pool } from './db.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(express.json())

// GET /tasks - Listar todas las tareas (con filtro opcional ?status=pending)
app.get('/tasks', async (req, res) => {
    try {
        const { status } = req.query
        const pagina = req.query.pagina ?? 0
        const limit = 5
        const result = status
            ? await pool.query('SELECT * FROM tasks WHERE status = $1 ORDER BY id LIMIT $3 OFFSET $2', [status, pagina*limit, limit])
            : await pool.query('SELECT * FROM tasks ORDER BY id LIMIT $2 OFFSET $1', [pagina*limit,limit])
        res.json(result.rows)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// GET /tasks/:id - Obtener una tarea por id
app.get('/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params
        const result = await pool.query('SELECT * FROM tasks WHERE id = $1', [id])

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' })
        }

        res.json(result.rows[0])
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// POST /tasks - Crear una nueva tarea
app.post('/tasks', async (req, res) => {
    try {
        const { title, description, dueDate } = req.body
        const status = req.body.status.toLowerCase()

        if (!title) {
            return res.status(400).json({ error: 'Title is required' })
        }
        if(status != 'pending' && status != 'completed') {
            return res.status(400).json({error: 'Solo se aceptan status de pending o completed'})
        }

        const result = await pool.query(
            `INSERT INTO tasks (title, description, status, due_date)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [title, description || '', status || 'pending', dueDate || null]
        )

        res.status(201).json(result.rows[0])
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// TODO PUT /tasks/:id - Actualizar una tarea existente
// Pistas:
// - Podes usar COALESCE para no pisar los campos que no vengan en el body:
//     UPDATE tasks
//     SET title = COALESCE($1, title),
//         description = COALESCE($2, description),
//         status = COALESCE($3, status),
//         due_date = COALESCE($4, due_date),
//         updated_at = NOW()
//     WHERE id = $5
//     RETURNING *
// - Si "RETURNING *" no devuelve filas, la tarea no existia -> responder 404
app.put('/tasks/:id', async (req, res) => {
    try{
        const {id} = req.params
        //const {title, description, status, duedate} = req.body
        const title = req.body.title ?? null
        const description = req.body.description ?? null
        const status = req.body.status ?? null
        const duedate = req.body.duedate ?? null
        const datos_actualizados = [id, title, description, status, duedate]
        console.log(req.body)
        console.log(datos_actualizados)
        const actualizacion = await pool.query(`UPDATE tasks
        SET title = COALESCE($2, title),
            description = COALESCE($3, description),
            status = COALESCE($4, status),
            due_date = COALESCE($5, due_date),
            updated_at = NOW()
        WHERE id = $1
        REturning *`, datos_actualizados)
       // const actualizacion = await pool.query(`UPDATE tasks SET title = 'HOLA' WHERE id= $1 RETURNING *`,[id, title, description, status, duedate])
        console.log('exito')
        res.status(200).json({mesagge:'datos actualizados'})
    } catch(err) {
        res.status(404).json({ error: err })        
    }

})

// TODO DELETE /tasks/:id - Eliminar una tarea
// Pistas:
// - DELETE FROM tasks WHERE id = $1 RETURNING *
// - Si no devuelve filas, la tarea no existia -> responder 404
// - Si borra correctamente, responder 204 sin body
app.delete('/tasks/:id', async (req, res) => {
    try{
        const {id} = req.params
        const eliminar = pool.query(`DELETE FROM tasks WHERE id = $1 RETURNING*`, [id])
        res.status(204).send()
    }catch(err) {
        res.status(404).json({error: 'tarea inexistente'})
    }
})

app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`)
    console.log(`📝 API endpoints available at /tasks`)
})
