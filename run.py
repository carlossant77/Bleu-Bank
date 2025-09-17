from flask import Flask, render_template, request, redirect, session
import sqlite3

app = Flask(__name__)

app.secret_key = "uma_chave_secreta_qualquer"  



@app.route("/")
def index():
    return render_template("index.html")

@app.route("/cadastro", methods=["GET", "POST"])
def cadastro():
    if request.method == "POST":
        
        nome = request.form['nome']
        nascimento = request.form['nascimento']
        user = request.form['user']

       
        return render_template("senha.html", nome=nome, nascimento=nascimento, user=user)
    return render_template("cadastro.html")

# Segundo formulário /senha
@app.route("/senha", methods=["POST"])
def senha():
    senha = request.form.get('senha')
    senha_confirm = request.form.get('senha_confirm')
    nome = request.form.get('nome')
    nascimento = request.form.get('nascimento')
    user = request.form.get('user')

    if not senha or not senha_confirm or not nome or not user:
        return redirect("/cadastro")

    if senha != senha_confirm:
        # renderiza de novo a tela com erro
        return render_template(
            "senha.html",
            nome=nome,
            nascimento=nascimento,
            user=user,
            erro="As senhas não coincidem!"
        )

    try:
        conn = sqlite3.connect("models/bank.db")
        c = conn.cursor()
        c.execute("""
            INSERT INTO user (nome, nascimento, user, senha)
            VALUES (?, ?, ?, ?)
        """, (nome, nascimento, user, senha))
        conn.commit()
        conn.close()
        return redirect("/login")
    except sqlite3.IntegrityError:
        return render_template(
            "senha.html",
            nome=nome,
            nascimento=nascimento,
            user=user,
            erro="Usuário já existe! Tente outro nome de usuário."
        )


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        user = request.form.get("user")
        senha = request.form.get("senha")

        conn = sqlite3.connect("models/bank.db")
        c = conn.cursor()
        c.execute("SELECT * FROM user WHERE user = ? AND senha = ?", (user, senha))
        resultado = c.fetchone()
        conn.close()

        if resultado:
            session['nome'] = resultado[1]  # coluna 'nome' do banco
            return redirect("/inicial")
        else:
            # renderiza novamente a tela de login com a mensagem
            return render_template("login.html", erro="Usuário ou senha incorretos!")

    return render_template("login.html")

# Tela inicial
@app.route("/inicial")
def inicial():
    if "nome" not in session:   # se não estiver logado
        return redirect("/login")

    nome = session["nome"]      # já existe, então pode usar direto
    return render_template("inicial.html", nome=nome)


@app.route("/logout")
def logout():
    session.clear()
    return redirect("/")


if __name__ == "__main__":
    app.run(debug=True)
