<section id="shopping-cart-page">
    <h2>Seu Carrinho de Compras</h2>

    <?php
    // Simulação estática de um carrinho com itens.
    // Em uma aplicação real, isso seria dinâmico, baseado em sessões.
    $cart_items = [
        [
            'id' => 1,
            'name' => 'Camisa Oficial do Time (Azul)',
            'price' => 89.90,
            'quantity' => 1,
            'image' => 'assets/images/placeholder_camisa_azul.png'
        ],
        [
            'id' => 3,
            'name' => 'Boné Volei Futuro',
            'price' => 49.90,
            'quantity' => 2,
            'image' => 'assets/images/placeholder_bone.png'
        ]
    ];

    $subtotal = 0;
    ?>

    <table class="cart-table">
        <thead>
            <tr>
                <th colspan="2">Produto</th>
                <th>Preço</th>
                <th>Quantidade</th>
                <th>Total</th>
            </tr>
        </thead>
        <tbody>
            <?php
            foreach ($cart_items as $item) {
                $total = $item['price'] * $item['quantity'];
                $subtotal += $total;
                echo '<tr>';
                echo '<td><img src="' . htmlspecialchars($item['image']) . '" alt="' . htmlspecialchars($item['name']) . '" width="80"></td>';
                echo '<td>' . htmlspecialchars($item['name']) . '</td>';
                echo '<td>R$ ' . number_format($item['price'], 2, ',', '.') . '</td>';
                echo '<td>' . htmlspecialchars($item['quantity']) . '</td>';
                echo '<td>R$ ' . number_format($total, 2, ',', '.') . '</td>';
                echo '</tr>';
            }
            ?>
        </tbody>
    </table>

    <div class="cart-summary">
        <h3>Resumo do Pedido</h3>
        <p>Subtotal: <strong>R$ <?php echo number_format($subtotal, 2, ',', '.'); ?></strong></p>
        <p>Frete: <strong>A calcular</strong></p>
        <p>Total: <strong>R$ <?php echo number_format($subtotal, 2, ',', '.'); ?></strong></p>
        <a href="#" class="cta-button">Finalizar Compra</a>
    </div>

</section>
